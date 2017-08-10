# .mov to .mp4 lambda

[![Build Status](https://travis-ci.org/mblink/mov-to-mp4-lambda.svg?branch=master)](https://travis-ci.org/mblink/mov-to-mp4-lambda)

This is a [lambda](https://aws.amazon.com/lambda/) that will convert S3 objects with a `.mov` extension to `.mp4`
files. It downloads the `.mov` file, performs the conversion with `ffmpeg`, then reuploads the `.mp4` file.

## Setup

Clone the repository, then run the following:

```bash
$ npm install
$ cp .env.sample .env
$ cp deploy.env.sample deploy.env
$ cp event.json.sample event.json
```

In `.env`, replace the value of `AWS_ROLE_ARN` with the value you create below in ["Create a role"](#create-a-role).
Replace other config values as necessary,

In `deploy.env`, add your own secret values to use when sending the email notification with SendGrid. The values are:

- `FROM_EMAIL`: The email address you'd like the notification to appear to be sent from
- `TO_EMAIL`: The email address you'd like the notification to be sent to
- `SENDGRID_API_KEY`: Your SendGrid API key. If necessary, you can [create a new one here](https://app.sendgrid.com/settings/api_keys)

### Create a role

First create an IAM policy that has full `Get` and `Put` access to your S3 bucket, then in the
[IAM roles console](https://console.aws.amazon.com/iam/home#/roles), create a new role. When you're prompted to
choose a role type, select "AWS Lambda." When you're prompted to attach policies, attach the one you just created and
the one named "CloudWatchLogsFullAccess."

Once you've finished creating the role, copy the ARN and put it in `.env` as mentioned above.

## Run locally

To run the lambda function locally using the contents of `event.json` as the payload, run:

```bash
$ npm run local
```

## Deploy

To deploy the lambda to AWS, run:

```bash
$ npm run deploy
```

## Package

If you want to package the lambda as a zip file for manual upload to AWS, run:

```bash
$ npm run package
```

### Subscribe to S3 uploads

In the AWS lambda console, add a trigger for your function. Specify the bucket you want to monitor, the event type as
"Object Created (All)", and the suffix as ".mov". It should look like this:

![trigger](https://user-images.githubusercontent.com/4718399/29190808-7630af40-7de9-11e7-9eda-d7a0010707b3.png)
