# Use a lightweight Node.js image
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first (cache optimization)
COPY package*.json ./

# Install dependencies (production only)
RUN npm install --only=production

# Copy the rest of your backend code
COPY . .

# Ensure uploads folder exists
RUN mkdir -p uploads

# Expose PORT 5002 (your chosen port)
EXPOSE 5002

# Start the Node app (entry file is app.js)
CMD ["node", "app.js"]
