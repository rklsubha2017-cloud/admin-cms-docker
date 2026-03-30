# STAGE 1: Build Environment
# Use the exact Node version requested
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package.json files first for caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy all frontend source code
COPY . .

# Build the Vite project for production
# This creates a 'dist' folder containing the static files
RUN npm run build

# STAGE 2: Production Server
FROM nginx:alpine

# Remove default Nginx placeholder files
RUN rm -rf /usr/share/nginx/html/*

# Copy the built files from the "builder" stage into the Nginx web directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy our custom routing configuration (required for React Router)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]