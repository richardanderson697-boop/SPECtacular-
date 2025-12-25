# Upload and Export Features

## Document Upload

ASSURE-CODE now supports uploading existing project documents to extract text for specification generation.

### Supported Formats
- **PDF** - Portable Document Format
- **TXT** - Plain text files
- **MD** - Markdown files
- **DOCX** - Microsoft Word documents

### File Size Limit
Maximum 10MB per file

### How to Use
1. Click **Upload** in the header navigation
2. Drag and drop a file or click **Choose File**
3. Click **Upload & Extract Text**
4. Review the extracted content
5. Click **Use This Text** to populate your specification input

The extracted text will be automatically inserted into your project description field.

---

## Specification Export

Once you've generated a specification, you can export it in multiple formats for different use cases.

### Export Formats

#### 1. Copy to Clipboard
- **Individual Sections**: Copy any single section (Master Spec, Cost Analysis, etc.)
- **Copy All**: Copy the entire specification as formatted markdown

#### 2. CSV Export
Exports specification as a comma-separated values file with two columns:
- **Section**: The name of each section
- **Content**: The full content of that section

**Use Cases:**
- Import into spreadsheet applications
- Data analysis and reporting
- Bulk processing workflows

#### 3. JSON Export
Exports the complete specification as structured JSON including:
- Specification metadata (ID, title, control number, timestamps)
- All section content organized in a sections object
- Workspace reference

**Use Cases:**
- API integrations
- Programmatic processing
- Archiving and version control
- Custom application integrations

#### 4. OpenAI Format Export
Exports specification as a pre-formatted OpenAI API payload including:
- System message context
- Conversation-style messages for each section
- Ready-to-use API configuration (model, max_tokens, temperature)

**Use Cases:**
- Fine-tuning OpenAI models
- Building custom AI assistants with your specifications
- Training data preparation
- AI-powered specification analysis tools

### How to Export

1. Open any specification from your workspace
2. Click the **Export** button in the top right
3. Select your desired export format from the dropdown menu
4. Files will automatically download to your device

### Export File Naming
All exports use the format: `{specification-title}_{format}.{extension}`

Examples:
- `User Authentication System_specification.csv`
- `Payment Gateway_specification.json`
- `Mobile App_openai_format.json`

---

## Technical Implementation

### Text Extraction
The upload feature uses:
- Built-in text parsing for TXT and MD files
- `pdf-parse` library for PDF text extraction
- `mammoth` library for DOCX text extraction

### Export Utilities
All export functions are implemented client-side using:
- Native JavaScript Blob API for file generation
- `downloadFile()` utility for consistent download behavior
- Proper MIME types and encoding for each format

### Security
- All uploads require authentication
- File type validation on both client and server
- Size limits enforced to prevent abuse
- Temporary file processing (no permanent storage of uploaded documents)

---

## Future Enhancements

Planned features:
- Batch document upload
- Multi-format export (export all formats at once)
- Custom export templates
- Cloud storage integrations (Google Drive, Dropbox)
- OCR support for scanned documents
- Collaborative export sharing
