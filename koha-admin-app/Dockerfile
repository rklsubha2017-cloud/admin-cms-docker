# Use standard slim Python image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements and install
# We do this before copying the rest of the code to leverage Docker's layer caching.
# If your code changes but requirements don't, Docker skips this step, saving time.
RUN apt-get update && apt-get install -y \
    openssh-client \
    zip \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY . .

RUN mkdir -p static/downloads

# Expose the port (Gunicorn defaults to 8000, but you can bind to 5000)
EXPOSE 5000

# The command to run the app using Gunicorn and Eventlet for SocketIO support
# We bind it to 0.0.0.0 so it is accessible outside the container
CMD ["gunicorn", "--worker-class", "eventlet", "-w", "1", "--bind", "0.0.0.0:5000", "app:app"]