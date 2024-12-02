FROM mcr.microsoft.com/playwright:v1.49.0-noble

# Install Xvfb and dependencies
RUN apt-get update && apt-get install -y \
    xvfb \
    libx11-dev \
    libxcomposite1 \
    libxdamage1 \
    libxi6 \
    libxtst6 \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy and install dependencies
COPY package.json package-lock.json ./
RUN npm install && npx playwright install

# Copy the rest of the application code
COPY . .

# Expose the application port
EXPOSE 3000

# Start Xvfb and then the app
CMD ["xvfb-run", "--auto-servernum", "--server-args=-screen 0 1280x1024x24", "node", "server.js"]