import requests
from bs4 import BeautifulSoup
import json
import csv
import re
import time
import sys
import urllib3
import pandas as pd
import os

# Create covers directory
COVERS_DIR = 'covers'
os.makedirs(COVERS_DIR, exist_ok=True)

def sanitize_filename(name):
    # Replace characters that are invalid in Windows filenames
    return re.sub(r'[\\/*?:"<>|]', '_', name).strip()

def download_cover(url, title):
    if not url:
        return ""
    try:
        safe_title = sanitize_filename(title)
        ext = '.jpg'
        
        # Get clean URL without @... suffix if any
        clean_url = url.split('@')[0] if '@' in url else url
        if '.' in clean_url:
            possible_ext = clean_url.split('.')[-1].lower()
            if len(possible_ext) <= 4 and possible_ext in ['jpg', 'jpeg', 'png', 'webp', 'gif']:
                ext = f".{possible_ext}"
                
        filename = f"{safe_title}{ext}"
        local_path = os.path.join(COVERS_DIR, filename)
        
        # Check if file exists and is not empty
        if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
            return f"covers/{filename}"
            
        print(f"  正在下載封面: {title}...")
        res = requests.get(url, verify=False, timeout=15)
        if res.status_code == 200:
            with open(local_path, 'wb') as f:
                f.write(res.content)
            return f"covers/{filename}"
        else:
            print(f"  下載封面失敗 (狀態碼 {res.status_code}): {title}")
    except Exception as e:
        print(f"  下載封面失敗 {title}: {e}")
    return ""

# Ensure output encoding is UTF-8 for console printing
sys.stdout.reconfigure(encoding='utf-8')

# Disable SSL warning
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = 'https://ssr1.scrape.center/page/{page}'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def scrape_page(page_num):
    url = BASE_URL.format(page=page_num)
    print(f"[{time.strftime('%X')}] 正在爬取第 {page_num} 頁: {url}")
    try:
        response = requests.get(url, headers=HEADERS, verify=False, timeout=15)
        if response.status_code != 200:
            print(f"Error: 請求失敗，狀態碼: {response.status_code}")
            return []
        
        response.encoding = 'utf-8'
        soup = BeautifulSoup(response.text, 'html.parser')
        cards = soup.select('.el-card.item')
        movies = []
        
        for card in cards:
            # 1. 標題
            title_el = card.select_one('a.name h2')
            title = title_el.get_text(strip=True) if title_el else "未知電影"
            
            # 2. 封面
            cover_el = card.select_one('img.cover')
            cover = cover_el.get('src') if cover_el else ""
            
            # 3. 分類
            categories = [btn.get_text(strip=True) for btn in card.select('.categories button span')]
            
            # 4. 地區與片長
            regions = []
            runtime = None
            info_divs = card.select('.info')
            
            if len(info_divs) > 0:
                spans = [s.get_text(strip=True) for s in info_divs[0].select('span') if s.get_text(strip=True)]
                # 過濾掉斜線分隔符
                spans = [s for s in spans if s != "/"]
                if len(spans) >= 1:
                    regions = [r.strip() for r in spans[0].split('、')]
                if len(spans) >= 2:
                    runtime_str = spans[1]
                    digits = re.findall(r'\d+', runtime_str)
                    if digits:
                        runtime = int(digits[0])
            
            # 5. 上映時間
            release_date = ""
            if len(info_divs) > 1:
                date_str = info_divs[1].get_text(strip=True)
                date_match = re.search(r'\d{4}-\d{2}-\d{2}', date_str)
                if date_match:
                    release_date = date_match.group(0)
            
            # 6. 評分
            score_el = card.select_one('p.score')
            try:
                score = float(score_el.get_text(strip=True)) if score_el else 0.0
            except ValueError:
                score = 0.0
                
            local_cover = download_cover(cover, title)
            
            movie = {
                "title": title,
                "cover": cover,
                "local_cover": local_cover,
                "categories": categories,
                "regions": regions,
                "runtime": runtime,
                "release_date": release_date,
                "score": score
            }
            movies.append(movie)
            
        print(f"成功抓取第 {page_num} 頁，共 {len(movies)} 部電影")
        return movies
    except Exception as e:
        print(f"Error: 爬取第 {page_num} 頁發生異常: {e}")
        return []

def main():
    all_movies = []
    print("=== 開始爬取電影資料 (ssr1.scrape.center) ===")
    
    # 爬取 1 到 10 頁
    for page in range(1, 11):
        page_movies = scrape_page(page)
        all_movies.extend(page_movies)
        # 稍微延遲避免請求過於頻繁
        time.sleep(1)
        
    print(f"\n爬取完成！共收集到 {len(all_movies)} 筆電影資料。")
    
    # 儲存為 JSON
    json_path = 'movies.json'
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(all_movies, f, ensure_ascii=False, indent=2)
    print(f"已儲存資料至 {json_path}")
    
    # 儲存為 CSV
    csv_path = 'movies.csv'
    with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        # 標題列
        writer.writerow(['片名', '封面網址', '本地封面路徑', '分類', '地區', '片長(分鐘)', '上映日期', '評分'])
        for m in all_movies:
            writer.writerow([
                m['title'],
                m['cover'],
                m.get('local_cover', ''),
                ','.join(m['categories']),
                ','.join(m['regions']),
                m['runtime'] if m['runtime'] is not None else "",
                m['release_date'],
                m['score']
            ])
    print(f"已儲存資料至 {csv_path}")

    # 儲存為 Excel (.xlsx)
    xlsx_path = 'movies.xlsx'
    try:
        df = pd.DataFrame(all_movies)
        df_excel = df.rename(columns={
            "title": "片名",
            "cover": "封面網址",
            "local_cover": "本地封面路徑",
            "categories": "分類",
            "regions": "地區",
            "runtime": "片長(分鐘)",
            "release_date": "上映日期",
            "score": "評分"
        })
        # 轉換陣列欄位為逗號分隔字串
        df_excel["分類"] = df_excel["分類"].apply(lambda x: ",".join(x) if isinstance(x, list) else x)
        df_excel["地區"] = df_excel["地區"].apply(lambda x: ",".join(x) if isinstance(x, list) else x)
        
        df_excel.to_excel(xlsx_path, index=False)
        print(f"已儲存資料至 {xlsx_path}")
    except Exception as e:
        print(f"儲存 Excel 發生錯誤: {e}")

if __name__ == '__main__':
    main()
