import os
import glob
import json
import shutil
import tempfile
from dotenv import load_dotenv
from parsers.factory import ParserFactory
from parsers.preprocessing import crop_to_document, enhance_document_image, rasterize_pdf_page

load_dotenv()

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def prepare_for_parsing(file_path: str) -> str:
    """
    Rasterize PDFs and run the same shadow/contrast cleanup used by the API,
    so CLI results match what /parse-batch produces. Always returns a path
    to a temporary working copy — the original file in images/ is never
    modified or overwritten.
    """
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        image_path = rasterize_pdf_page(file_path)
    else:
        fd, image_path = tempfile.mkstemp(suffix=ext)
        os.close(fd)
        shutil.copyfile(file_path, image_path)

    if os.path.splitext(image_path)[1].lower() in IMAGE_EXTENSIONS:
        crop_to_document(image_path)
        enhance_document_image(image_path)

    return image_path


def main():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("Please set your GEMINI_API_KEY inside the .env file.")

    input_dir = "images"
    output_dir = "outputs"

    # Ensure directories exist
    os.makedirs(input_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)

    # Initialize the universal auto-parser just ONCE
    parser = ParserFactory.get_parser(doc_type="auto", api_key=api_key)

    # Automatically find ALL images and PDFs in the 'images' folder
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

    # Loop through and parse them dynamically
    for file_path in files_to_process:
        filename = os.path.basename(file_path)
        base_name = os.path.splitext(filename)[0]
        output_path = os.path.join(output_dir, f"{base_name}_result.json")

        print(f"{'='*60}")
        print(f"PROCESSING: {filename}")
        print(f"{'='*60}")

        prepared_path = None
        try:
            prepared_path = prepare_for_parsing(file_path)

            # The AI figures out the document type automatically
            result = parser.parse(prepared_path)

            # Print to the terminal in a clean format
            print("\nEXTRACTION SUCCESSFUL:")
            print(json.dumps(result, indent=4, ensure_ascii=False))

            # Save the individual result
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=4, ensure_ascii=False)

            print(f"\nSaved detailed file to: {output_path}\n")

        except Exception as e:
            print(f"\nERROR processing {filename}: {str(e)}\n")

        finally:
            # Clean up the temp working copy — never delete the original.
            if prepared_path and prepared_path != file_path and os.path.exists(prepared_path):
                os.remove(prepared_path)

    print(f"{'='*60}")
    print("BATCH PROCESSING COMPLETE!")
    print(f"Check the '{output_dir}' folder for all your JSON files.")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
