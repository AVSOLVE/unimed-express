FROM mcr.microsoft.com/playwright:focal

# Set the working directory
WORKDIR /app

# Copy and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]
