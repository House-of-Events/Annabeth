job "get-all-daily-fixtures-cron" {
  datacenters = ["dc1", "dc2"]
  type = "batch"

  periodic {
    crons = ["* * * * *"]  # Run every minute for testing
    time_zone = "America/Los_Angeles"
  }

  group "daily-fixture-worker" {
    count = 1

    task "node-consumer" {
      driver = "docker"

      config {
        image = "manan78424/get-all-fixtures-daily-from-db:v5"
        command = "node"
        args = [
          "src/workers/route-get-all-daily-fixtures.js"
        ]
      }

      # Use Nomad variables for secure credential injection
      template {
        data = <<EOH
{{ with nomadVar "secret/aws-creds" }}
AWS_ACCESS_KEY_ID="{{ .aws_access_key_id }}"
AWS_SECRET_ACCESS_KEY="{{ .aws_secret_access_key }}"
{{ end }}
EOH
        destination = "secrets/aws.env"
        env = true
      }

      env {
        NODE_ENV = "development"
        AWS_REGION = "us-west-2"
      }


      resources {
        cpu    = 10
        memory = 256
      }
    }
  }
} 