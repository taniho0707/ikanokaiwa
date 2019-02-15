FROM node:10.15.1

ADD ./ /app
WORKDIR /app

RUN yarn

ENTRYPOINT ["yarn", "start"]
