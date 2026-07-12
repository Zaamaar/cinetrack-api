# CineTrack — AWS deployment runbook

Follow this in order. Run from your terminal where you already have AWS CLI and GitHub CLI configured. Replace `<region>`, `<account-id>`, and `<your-github-username>` throughout.

## 0. Prerequisites
```bash
aws sts get-caller-identity          # confirm AWS CLI is authenticated
gh auth status                       # confirm GitHub CLI is authenticated
```

## 1. Push the code to GitHub
```bash
cd cinetrack-api
git init
git add .
git commit -m "Initial commit: CineTrack API"
gh repo create cinetrack-api --public --source=. --push
```

## 2. Create the ECR repository
```bash
aws ecr create-repository \
  --repository-name cinetrack-api \
  --image-scanning-configuration scanOnPush=true \
  --region <region>
```
Save the `repositoryUri` from the output — you'll need it as `ECR_REPO_URI`.

## 3. Store secrets in Parameter Store (referenced by buildspec.yml)
```bash
aws ssm put-parameter --name "/cinetrack/jwt_secret" --value "$(openssl rand -base64 32)" --type SecureString
aws ssm put-parameter --name "/cinetrack/db_password" --value "<choose-a-strong-password>" --type SecureString
```

## 4. Set up RDS (PostgreSQL)
```bash
aws rds create-db-instance \
  --db-instance-identifier cinetrack-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username cinetrack_user \
  --master-user-password <same-password-as-step-3> \
  --allocated-storage 20 \
  --db-name cinetrack_db \
  --publicly-accessible false \
  --vpc-security-group-ids <your-sg-id>
```
Once available, run `src/models/schema.sql` against it (e.g. via a bastion host or `psql` from an EC2 instance in the same VPC).

## 5. Create the ECS cluster (Fargate)
```bash
aws ecs create-cluster --cluster-name cinetrack-cluster
```

## 6. Register a task definition
Create `task-definition.json` referencing your ECR image URI, then:
```bash
aws ecs register-task-definition --cli-input-json file://task-definition.json
```
Task definition should inject `DB_HOST`, `DB_PASSWORD`, `JWT_SECRET` from Parameter Store/Secrets Manager — not hardcoded.

## 7. Create the ALB + target group
```bash
aws elbv2 create-load-balancer --name cinetrack-alb --subnets <subnet-1> <subnet-2> --security-groups <sg-id>
aws elbv2 create-target-group --name cinetrack-tg --protocol HTTP --port 3000 --vpc-id <vpc-id> --target-type ip --health-check-path /health
```

## 8. Create the ECS service
```bash
aws ecs create-service \
  --cluster cinetrack-cluster \
  --service-name cinetrack-service \
  --task-definition cinetrack-api \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<subnet-1>,<subnet-2>],securityGroups=[<sg-id>],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=<tg-arn>,containerName=cinetrack-api,containerPort=3000"
```

## 9. Connect CodePipeline to GitHub
```bash
aws codestar-connections create-connection \
  --provider-type GitHub \
  --connection-name cinetrack-github-connection
```
This returns a `ConnectionArn` — you must approve it once in the AWS Console (Developer Tools → Connections) before it goes ACTIVE.

## 10. Create the CodeBuild project
```bash
aws codebuild create-project \
  --name cinetrack-build \
  --source type=CODEPIPELINE,buildspec=buildspec.yml \
  --artifacts type=CODEPIPELINE \
  --environment type=LINUX_CONTAINER,image=aws/codebuild/amazonlinux2-x86_64-standard:5.0,computeType=BUILD_GENERAL1_SMALL,privilegedMode=true \
  --service-role <codebuild-service-role-arn>
```
The CodeBuild role needs: `ecr:GetAuthorizationToken`, `ecr:PutImage`, `ecr:BatchCheckLayerAvailability`, `ecr:BatchGetImage`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload`, and `ssm:GetParameters` for the two secrets.

## 11. Create the CodePipeline
Build a `pipeline.json` with three stages — Source (GitHub via the connection from step 9), Build (CodeBuild project from step 10), Deploy (ECS cluster/service from step 8) — then:
```bash
aws codepipeline create-pipeline --cli-input-json file://pipeline.json
```

## 12. Verify end-to-end
```bash
git commit --allow-empty -m "Trigger pipeline"
git push
aws codepipeline get-pipeline-state --name cinetrack-pipeline
```
Watch it move through Source → Build → Deploy. Once Deploy succeeds, hit the ALB DNS name at `/health`.

## 13. Set up CloudWatch alarms
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name cinetrack-deploy-failure \
  --metric-name FailedDeployments \
  --namespace AWS/ECS \
  --statistic Sum \
  --period 300 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualTo \
  --evaluation-periods 1
```

---

## What to write about afterward
- Medium article: "Building a native AWS CI/CD pipeline — CodePipeline vs GitHub Actions, what I learned"
- LinkedIn: before/after — "manual deploy took X minutes, now it's a `git push`"
- Resume line: "Designed and deployed CineTrack, a containerized Node.js/PostgreSQL API, with a fully automated AWS-native CI/CD pipeline (CodePipeline, CodeBuild, ECR, ECS Fargate, ALB) — zero manual deployment steps from commit to production."
