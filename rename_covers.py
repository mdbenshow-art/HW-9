import os
import json
import csv
import sys
import pandas as pd

# Reconfigure output encoding to UTF-8 to prevent encoding errors on Windows terminal
sys.stdout.reconfigure(encoding='utf-8')

COVERS_DIR = 'covers'

def main():
    json_path = 'movies.json'
    csv_path = 'movies.csv'
    xlsx_path = 'movies.xlsx'
    
    if not os.path.exists(json_path):
        print("Error: movies.json does not exist!")
        return

    with open(json_path, 'r', encoding='utf-8') as f:
        movies = json.load(f)

    print(f"Loaded {len(movies)} movies from JSON.")
    
    # Store old to new mapping for updating other files
    old_to_new = {}
    
    for idx, m in enumerate(movies, 1):
        old_local = m.get('local_cover', '')
        if not old_local:
            continue
            
        # Get filename extension
        _, ext = os.path.splitext(old_local)
        if not ext:
            ext = '.jpg'
            
        new_filename = f"cover_{idx}{ext}"
        new_local = f"covers/{new_filename}"
        
        # Path details
        old_path = os.path.join(COVERS_DIR, os.path.basename(old_local))
        new_path = os.path.join(COVERS_DIR, new_filename)
        
        # Rename file if it exists
        if os.path.exists(old_path):
            try:
                # If they are different, rename
                if old_path != new_path:
                    # If target already exists, remove it first
                    if os.path.exists(new_path):
                        os.remove(new_path)
                    os.rename(old_path, new_path)
                    # Safe print without non-ASCII if possible, or using safe sys.stdout
                    print(f"Renamed cover {idx}: {new_filename}")
                old_to_new[old_local] = new_local
                m['local_cover'] = new_local
            except Exception as e:
                print(f"Failed to rename cover {idx}: {e}")
        elif os.path.exists(new_path):
            # Already renamed
            old_to_new[old_local] = new_local
            m['local_cover'] = new_local
        else:
            print(f"Warning: Cover not found for {idx} at {new_filename}")

    # Save movies.json
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(movies, f, ensure_ascii=False, indent=2)
    print("Saved updated movies.json")

    # Update CSV
    if os.path.exists(csv_path):
        try:
            rows = []
            with open(csv_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.reader(f)
                header = next(reader)
                rows.append(header)
                # Find index of '本地封面路徑' (Local Cover Path)
                local_cover_col_idx = header.index('本地封面路徑')
                
                for row in reader:
                    old_val = row[local_cover_col_idx]
                    if old_val in old_to_new:
                        row[local_cover_col_idx] = old_to_new[old_val]
                    rows.append(row)
            
            with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                writer.writerows(rows)
            print("Saved updated movies.csv")
        except Exception as e:
            print(f"Failed to update movies.csv: {e}")

    # Update XLSX
    if os.path.exists(xlsx_path):
        try:
            df = pd.read_excel(xlsx_path)
            # rename column or map values
            if '本地封面路徑' in df.columns:
                df['本地封面路徑'] = df['本地封面路徑'].map(lambda x: old_to_new.get(x, x))
                df.to_excel(xlsx_path, index=False)
                print("Saved updated movies.xlsx")
        except Exception as e:
            print(f"Failed to update movies.xlsx: {e}")

if __name__ == '__main__':
    main()
