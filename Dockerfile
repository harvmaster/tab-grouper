FROM node:18-alpine as build

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the extension
RUN npm run build

# Use a minimal nginx image to serve the extension files
FROM nginx:alpine

# Copy the built extension from the build stage
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/popup.html /usr/share/nginx/html/
COPY --from=build /app/manifest.json /usr/share/nginx/html/
COPY --from=build /app/icons /usr/share/nginx/html/icons

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"] 