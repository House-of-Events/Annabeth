# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Install Chamber (detect architecture automatically)
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then ARCH="amd64"; fi && \
    if [ "$ARCH" = "aarch64" ]; then ARCH="arm64"; fi && \
    wget -O /usr/bin/chamber https://github.com/segmentio/chamber/releases/download/v2.13.1/chamber-v2.13.1-linux-${ARCH} && \
    chmod +x /usr/bin/chamber


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