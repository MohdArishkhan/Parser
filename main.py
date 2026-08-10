import os
import glob
import json
from dotenv import load_dotenv
from parsers.factory import ParserFactory

# Load environment variables
load_dotenv()

def main():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("Please set your GEMINI_API_KEY inside the .env file.")

    input_dir = "images"
    output_dir = "outputs"

    # Ensure directories exist
    os.makedirs(input_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)

    # 1. Initialize the universal auto-parser just ONCE
    parser = ParserFactory.get_parser(doc_type="auto", api_key=api_key)

    # 2. Automatically find ALL images and PDFs in the 'images' folder
    supported_extensions = ('*.jpg', '*.jpeg', '*.png', '*.webp', '*.pdf')
    files_to_process = []
    
    for ext in supported_extensions:
        files_to_process.extend(glob.glob(os.path.join(input_dir, ext)))
        # Also catch uppercase extensions like .JPG or .PDF
        files_to_process.extend(glob.glob(os.path.join(input_dir, ext.upper())))

    # Remove duplicates if any, and sort them alphabetically
    files_to_process = sorted(list(set(files_to_process)))

    if not files_to_process:
        print(f"\nWARNING: No documents found in the '{input_dir}' folder.")
        print("Please add some images or PDFs and run the script again.")
        return

    print(f"\nFound {len(files_to_process)} documents. Starting batch processing...\n")

    # 3. Loop through and parse them dynamically
    for file_path in files_to_process:
        # Get just the file name (e.g., 'form.jpg') and base name ('form')
        filename = os.path.basename(file_path)
        base_name = os.path.splitext(filename)[0]
        output_path = os.path.join(output_dir, f"{base_name}_result.json")

        print(f"{'='*60}")
        print(f"PROCESSING: {filename}")
        print(f"{'='*60}")
        
        try:
            # The AI figures out the document type automatically
            result = parser.parse(file_path)
            
            # Print to the terminal in a clean format
            print("\nEXTRACTION SUCCESSFUL:")
            print(json.dumps(result, indent=4, ensure_ascii=False))
            
            # Save the individual result
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=4, ensure_ascii=False)
                
            print(f"\nSaved detailed file to: {output_path}\n")
            
        except Exception as e:
            print(f"\nERROR processing {filename}: {str(e)}\n")

    print(f"{'='*60}")
    print("BATCH PROCESSING COMPLETE!")
    print(f"Check the '{output_dir}' folder for all your JSON files.")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()