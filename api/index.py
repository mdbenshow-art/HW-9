from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
from google import genai
import sys
import time

app = Flask(__name__)
CORS(app)

MOVIES_FILE = os.path.join(os.path.dirname(__file__), '..', 'movies.json')
movies_context_str = ""

if os.path.exists(MOVIES_FILE):
    try:
        with open(MOVIES_FILE, 'r', encoding='utf-8') as f:
            movies_data = json.load(f)
            
        optimized_list = []
        for idx, m in enumerate(movies_data, 1):
            optimized_list.append({
                "id": idx,
                "title": m.get("title", ""),
                "genres": m.get("categories", []),
                "regions": m.get("regions", []),
                "runtime_mins": m.get("runtime"),
                "release_date": m.get("release_date", ""),
                "score": m.get("score", 0.0)
            })
            
        movies_context_str = json.dumps(optimized_list, ensure_ascii=False)
        print(f"成功載入 {len(movies_data)} 部電影並壓縮至系統 Context 中！")
    except Exception as e:
        print(f"載入 movies.json 發生錯誤: {e}")
else:
    print(f"警告: 找不到 movies.json，路徑是 {MOVIES_FILE}，Chatbot 將以無數據狀態運行。")

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json or {}
        user_message = data.get('message', '')
        client_api_key = data.get('apiKey', '').strip()
        
        api_key = client_api_key or os.environ.get("GEMINI_API_KEY")
        
        if not api_key:
            return jsonify({
                "error": "請先設定 Gemini API Key！您可以點擊聊天視窗右上角的「設定」齒輪圖示輸入 API Key。"
            }), 400

        client = genai.Client(api_key=api_key)
        
        selected_model = 'gemini-2.5-flash'
        try:
            available_models = [m.name for m in client.models.list()]
            clean_models = [name.split('/')[-1] for name in available_models]
            
            priorities = [
                'gemini-2.5-flash', 
                'gemini-2.0-flash', 
                'gemini-1.5-flash',
                'gemini-1.5-flash-latest'
            ]
            
            for p in priorities:
                if p in clean_models:
                    selected_model = p
                    break
            else:
                flash_models = [name for name in clean_models if 'flash' in name.lower()]
                if flash_models:
                    selected_model = flash_models[0]
                elif clean_models:
                    selected_model = clean_models[0]
        except Exception as list_err:
            print(f"無法列出模型列表 (將使用預設 gemini-2.5-flash): {list_err}")
            
        system_instruction = (
            "你是 CineScrape 影音智慧助理，一個親切、專業的 AI 助手。\n"
            "你的任務是根據以下提供的「CineScrape 電影數據庫」內容，解答使用者關於這 100 部電影的各種問題。\n"
            "你可以：\n"
            "1. 進行電影推薦（例如：推薦適合情侶看的愛情片、尋找評分 9.0 以上的神作）。\n"
            "2. 進行條件篩選（例如：找出片長小於 100 分鐘的喜劇片、有哪些是香港或內地拍攝的電影）。\n"
            "3. 進行簡單統計（例如：資料庫中哪一個類型最多、平均播放時間是多少）。\n\n"
            "規定與風格：\n"
            "- 請一律使用繁體中文 (Traditional Chinese) 回答，口氣親切、生動且帶有表情符號（Emoji）。\n"
            "- 如果使用者問及電影數據庫「之外」的電影或一般話題，你可以簡短回答，但請禮貌地提示你是 CineScrape 電影助理，並引導他們問與這 100 部電影相關的話題。\n\n"
            f"CineScrape 電影數據庫（共 100 部）：\n{movies_context_str}"
        )
        
        prompt = f"{system_instruction}\n\n使用者對話歷史與提問：\n{user_message}\n\n請產生回覆："
        
        response = client.models.generate_content(
            model=selected_model,
            contents=prompt
        )
        
        return jsonify({
            "reply": response.text
        })
        
    except Exception as e:
        error_str = str(e)
        print(f"Chat error: {error_str}")
        
        if 'API_KEY_INVALID' in error_str or 'API key not valid' in error_str:
            return jsonify({
                "error": "🔑 API Key 無效！請點擊聊天視窗右上角的「⚙️ 設定」齒輪，重新確認並貼上正確的 Gemini API Key。\n\n取得免費 API Key 的方式：前往 https://aistudio.google.com/ → 點選「Get API key」→ 複製以 AIzaSy 開頭的金鑰。",
                "needsApiKey": True
            }), 400
        elif 'RESOURCE_EXHAUSTED' in error_str or 'prepayment credits' in error_str.lower() or 'quota' in error_str.lower():
            return jsonify({
                "error": "⚠️ 额度已耗尽！您的預付金額已用完，請前往 AI Studio 於 https://ai.studio/projects 管理專案與計費，或升級方案取得更多配額。",
                "needsBilling": True
            }), 429
        else:
            return jsonify({
                "error": f"⚠️ 連線錯誤：{error_str}"
            }), 500
