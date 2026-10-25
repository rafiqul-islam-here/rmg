variable "APP_COMMIT" { type = string }
variable "CLOUDFLARE_TUNNEL_TOKEN" { type = string }
variable "EMAIL_PORT" { type = string }
variable "EMAIL_HOST" { type = string }
variable "INITIAL_ADMIN_EMAIL" { type = string }
variable "EMAIL_USE_TLS" { type = string }
variable "EMAIL_HOST_PASSWORD" { type = string }
variable "MAIL_DEFAULT_SENDER" { type = string }
variable "EMAIL_HOST_USER" { type = string }
variable "EMAIL_USE_SSL" { type = string }
variable "INITIAL_ADMIN_PASSWORD" { type = string }
variable "WEBSITE_HEALTHCHECK_MAXPINGFAILURES" { type = string }
variable "FLASK_APP" { type = string }
variable "PORT" { type = string }
variable "FLASK_ENV" { type = string }
variable "DB_PORT" { type = string }
variable "DB_USER" { type = string }
variable "DB_HOST" { type = string }
variable "DB_NAME" { type = string }
variable "DB_PASSWORD" { type = string }
variable "SECRET_KEY" { type = string }
variable "R2_ACCESS_KEY_ID" { type = string }
variable "R2_BUCKET_NAME" { type = string }
variable "R2_PUBLIC_URL" { type = string }
variable "R2_SECRET_ACCESS_KEY" { type = string }
variable "R2_ACCOUNT_ID" { type = string }




job "mohsinrubel-portfolio" {
  namespace   = "prod"
  datacenters = ["dc1"]
  type        = "service"

  group "portfolio" {
    count = 1
    shutdown_delay = "10s"

    network {
      mode = "bridge"

      port "http" {
        to = 5000
      }
    }

    service {
      name         = "mohsinrubel-portfolio"
      port         = "http"
      provider     = "nomad"
      address_mode = "alloc"

      check {
        type         = "tcp"
        port         = "http"
        interval     = "10s"
        timeout      = "5s"
        address_mode = "alloc"
      }
    }


    task "ui" {
      driver = "podman"

      config {
        image = var.APP_COMMIT
        force_pull = true
      }

      env {
            EMAIL_PORT                          = var.EMAIL_PORT
            EMAIL_HOST                          = var.EMAIL_HOST
            INITIAL_ADMIN_EMAIL                 = var.INITIAL_ADMIN_EMAIL
            EMAIL_USE_TLS                       = var.EMAIL_USE_TLS
            EMAIL_HOST_PASSWORD                 = var.EMAIL_HOST_PASSWORD
            MAIL_DEFAULT_SENDER                 = var.MAIL_DEFAULT_SENDER
            EMAIL_HOST_USER                     = var.EMAIL_HOST_USER
            EMAIL_USE_SSL                       = var.EMAIL_USE_SSL
            INITIAL_ADMIN_PASSWORD              = var.INITIAL_ADMIN_PASSWORD
            WEBSITE_HEALTHCHECK_MAXPINGFAILURES = var.WEBSITE_HEALTHCHECK_MAXPINGFAILURES
            FLASK_APP                           = var.FLASK_APP
            PORT                                = var.PORT
            FLASK_ENV                           = var.FLASK_ENV
            DB_PORT                             = var.DB_PORT
            DB_USER                             = var.DB_USER
            DB_HOST                             = var.DB_HOST
            DB_NAME                             = var.DB_NAME
            DB_PASSWORD                         = var.DB_PASSWORD
            SECRET_KEY                          = var.SECRET_KEY
            R2_ACCESS_KEY_ID                    = var.R2_ACCESS_KEY_ID
            R2_BUCKET_NAME                      = var.R2_BUCKET_NAME
            R2_PUBLIC_URL                       = var.R2_PUBLIC_URL
            R2_SECRET_ACCESS_KEY                = var.R2_SECRET_ACCESS_KEY
            R2_ACCOUNT_ID                       = var.R2_ACCOUNT_ID
      }

      resources {
        cpu    = 500
        memory = 512
      }

      restart {
        attempts = 5
        interval = "30m"
        delay    = "15s"
        mode     = "delay"
      }
    }
  }










  # Traefik + Cloudflare Tunnel
  group "cloudflare" {

    count = 1

    shutdown_delay = "10s"

    network {
      mode = "bridge"

      port "web" {
        to = 80
      }
    }


# Traefik
    task "traefik" {

      driver = "podman"

      config {
        image = "docker.io/library/traefik:v3.1"

        args = [
          "--entrypoints.web.address=:80",
          "--providers.file.filename=/local/dynamic.yml",
          "--providers.file.watch=true",
          "--log.level=INFO"
        ]
      }


# Dynamic Traefik configuration
      template {
        data = <<EOF
http:

  routers:

    mohsinrubel-portfolio:
      rule: "PathPrefix(`/`)"
      entryPoints:
        - web
      service: mohsinrubel-portfolio


  services:
    mohsinrubel-portfolio:
      loadBalancer:

        servers:
{{ range nomadService "mohsinrubel-portfolio" }}
          - url: "http://{{ .Address }}:{{ .Port }}"
{{ end }}

EOF

        destination = "local/dynamic.yml"
      }

      resources {
        cpu    = 100
        memory = 128
      }

      restart {
        attempts = 10
        interval = "30m"
        delay    = "15s"
        mode     = "delay"
      }
    }


# Cloudflare Tunnel
    task "cloudflared" {
      driver = "podman"

      config {
        image = "docker.io/cloudflare/cloudflared:latest"

        args = [
          "tunnel",
          "--no-autoupdate",
          "run",
          "--token",
          var.CLOUDFLARE_TUNNEL_TOKEN
        ]
      }

      resources {
        cpu    = 100
        memory = 128
      }

      restart {
        attempts = 10
        interval = "30m"
        delay    = "15s"
        mode     = "delay"
      }
    }
  }
}
