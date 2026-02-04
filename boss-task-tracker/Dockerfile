FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3000
CMD ["npm", "start"]
