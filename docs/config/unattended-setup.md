# Unattended Setup

Horizon includes a feature called unattended setup. This allows you to predefine a number of configuration settings ahead of time. This is useful if you're deploying it at scale and want to pre-customize your instance of Horizon with customizations for your agency.

## Enabling Unattended Setup

To enable unattended setup, you'll need to set the `UNATTENDED_SETUP` environment variable to `true`, then set the various Unattended Setup options.

### Cloud platforms (Railway, Render, Fly.io)

If you deploy Horizon using a cloud platform, this should be available in the "Variables" settings for the service. This is also where you'll set the options for each Unattended Setup option.

### Docker deployment

If you deploy Horizon manually using Docker Compose, you can either set it in your Compose file as an environment variable like so:

```yaml
services:
  headsign:
    image: ghcr.io/jasonad123/horizon
    # ...
    environment:
      # ...Other environment variables
      UNATTENDED_SETUP: true
    # ...then you can set up your other UNATTENDED_X options below
```

or you can add it to a linked `.env` file.

`compose.yaml`

```yaml
services:
  # Usage: docker compose up -d
  headsign:
    image: ghcr.io/jasonad123/horizon
    # ...
    environment:
    # ...
    # Add your environment variables here or use an env_file
    env_file:
      - .env -
```

`.env`

```bash
# ... other .env items
UNATTENDED_SETUP=true
# ...then you can set up your other UNATTENDED_X options below
```

If using Docker run to deploy, follow the instructions to set `UNATTENDED_SETUP` variables in the `.env` file.

### Local

If deploying locally, set `UNATTENDED_SETUP=true` in your `.env` file.

`.env`

```bash
# ... other .env items
UNATTENDED_SETUP=true
# ...then you can set up your other UNATTENDED_X options below
```

## Unattended Setup options

The following options are available for unattended setup. You can choose to control as few or as many as you like. These options mirror the options available in the UI configuration.

### UNATTENDED_TITLE

Header title.

The default is **Horizon** in the selected UI language if not set.

### UNATTENDED_LOCATION

Location in lat, lng format (40.75426683398718, -73.98672703719805).

### UNATTENDED_TIME_FORMAT

Time display format for the clock in the upper right hand corner.

Options available:

- 24-hour - `HH:mm`
- 12-hour with AM/PM `hh:mm A`

The default is **24-hour** if not set.

### UNATTENDED_MAX_DISTANCE

Maximum distance in meters to search for nearby routes.

Options available: _250, 500, 750, 1000, 1250, 1500_

The default is **500 meters** if not set.

### UNATTENDED_SELECTED_STOPS

Comma-separated list of global_stop_ids to show. When set, the board queries stop_departures for these specific stops/bays/platforms.

When empty, this falls back to nearby_routes using `UNATTENDED_LOCATION`.

### UNATTENDED_MAX_DEPARTURES

Maximum number of rows shown on the board.

If not set, the default is 8.
