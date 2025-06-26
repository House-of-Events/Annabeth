# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Install Chamber for secrets management
RUN apk add --no-cache curl bash
RUN curl -L https://github.com/segmentio/chamber/releases/download/v2.12.0/chamber-v2.12.0-linux-amd64 -o /usr/local/bin/chamber && \
    chmod +x /usr/local/bin/chamber

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for development)
RUN npm ci

# Copy application code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Default command (can be overridden)
CMD ["node", "src/workers/route-get-all-daily-fixtures.js"] 