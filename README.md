# Horizon

Yet another real-time transit display application that shows arrival times for nearby public transit.

![Screenshot](/assets/horizon-screenshot.png)

<div style="text-align:center">

<img src="https://github.com/jasonad123/headsign/blob/main/assets/transit-api-badge.png?raw=true" width="25%" />

</div>

> [!WARNING]
> Headsign comes with no guarantee of any kind. I am **not** affiliated with Transit, just a big fan of their app.

## Prerequisites

- An API key from Transit - [keys can be requested here](https://transitapp.com/partners/apis)

Optional, for local deployment or development only

- Docker (recommended)
- Node.js (version specified in .node-version, for development/local deployment purposes only)
- pnpm (preferred package manager, for development/local deployment purposes only)

## Getting started

Go to the [Transit API page](https://transitapp.com/partners/apis) and request access to the API. When you have the API key, you can place it in your environment `.env` file or however variables/secrets are managed for your deployment method.

Once you have your API key, see [docs/getting-started](docs/getting-started.md) for more info on how to get started.

## License

See the [LICENSE](LICENSE) file for details.

## Additional disclaimers

> [!NOTE]
> **Generative AI:** The code for this project was developed with the help of generative AI tools, including Claude and Claude Code. While all outputs have been _lovingly_ reviewed and tested, users should validate results independently before use in production environments.
