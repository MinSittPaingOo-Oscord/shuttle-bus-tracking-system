FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Needed only so prisma generate works during build
ENV DATABASE_URL="postgresql://postgres:postgres@db:5432/shuttle_tracking"

RUN npx prisma generate
RUN npm run build

EXPOSE 5000

CMD ["npm", "start"]