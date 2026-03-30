# Using the exact base image requested
FROM python:3.11-slim-bullseye

# Set working directory
WORKDIR /app

# IMPORTANT: pdfkit requires wkhtmltopdf to function. 
# We must install system-level dependencies first.
RUN apt-get update && apt-get install -y \
    wkhtmltopdf \
    && rm -rf /var/lib/apt/lists/* # The rm command cleans up the apt cache to keep the image size small.

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend code
COPY . .

# Expose the FastAPI default port
EXPOSE 8000

# Run the FastAPI application using Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]