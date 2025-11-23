# Lightweight Node runtime image
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files separately for better caching
COPY package*.json ./

# Use npm ci if lockfile exists for deterministic installs
RUN if [ -f package-lock.json ]; then npm ci --only=production; else npm install --only=production; fi

# Copy app source
COPY . .

# Set environment
ENV NODE_ENV=production
EXPOSE 3000

# Build step if you have a build script (won't fail the image build if absent)
RUN if npm run | grep -q " build"; then npm run build || true; fi

# Start: try common start scripts as fallbacks
CMD ["sh", "-c", "npm run start || node index.js || node server.js"]