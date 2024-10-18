FROM node:20-alpine

RUN mkdir /src

WORKDIR /src

COPY package.json /src

RUN npm install --production --silent