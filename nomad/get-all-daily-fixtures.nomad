job "get-all-daily-fixtures" {
  datacenters = ["dc1", "dc2"]
  type = "service"

  group "get-all-daily-fixture-script" {
    count = 1

    # Restart policy
    restart {
      attempts = 3
      interval = "5m"
      delay    = "25s"
      mode     = "delay"
    }

    task "node-consumer" {
      driver = "docker"

      config {
        image = "manan78424/get-all-fixtures-daily-from-db:v1"
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
        cpu    = 20    # Increased for Node.js app
        memory = 128
      }

      # Add health check if your worker exposes health endpoint
      # service {
      #   name = "fixtures-daily-consumer"
      #   port = "health"
      #   
      #   check {
      #     name     = "alive"
      #     type     = "http"
      #     path     = "/health"
      #     interval = "10s"
      #     timeout  = "2s"
      #   }
      # }
    }
  }
}