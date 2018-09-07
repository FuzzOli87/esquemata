
# Base image
FROM node:10.6.0-alpine AS base
LABEL maintainer Daniel Olivares "daniel.olivares@parkhub.com"

RUN apk --no-cache add tini lz4-dev musl-dev cyrus-sasl-dev openssl-dev

RUN mkdir /home/app

WORKDIR /home/app

ENTRYPOINT ["tini", "--"]

COPY package.json package-lock.json ./

# Dependencies(including dev dependencies)
FROM base AS dependencies
RUN apk --no-cache add --virtual native-deps \
  g++ gcc libgcc libstdc++ linux-headers make python \
  bash ca-certificates \
  zlib-dev libc-dev bsd-compat-headers py-setuptools && \
  npm install --quiet node-gyp -g &&\
  npm install --quiet --only=production && \
  cp -R node_modules prod_node_modules && \
  npm install --quiet && \
  apk del native-deps

# Run unit test and linter
FROM dependencies AS test
COPY . .

# Build
FROM test AS build 
RUN npm start build 

# Release
FROM base AS release
COPY --from=dependencies /home/app/prod_node_modules ./node_modules
COPY --from=build /home/app/dist/ .

CMD ["node", "index.js"]
