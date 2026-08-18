# 21st.dev CLI — Setup

The [21st.dev CLI](https://21st.dev) (`@21st-dev/cli`) is installed globally on this
machine and used for searching/installing 21st.dev components and themes.

## Local development (signed in)

```bash
npm i -g @21st-dev/cli
21st login          # opens the browser; saves the token to ~/.config/21st/auth.json
```

Current account: `tameeer34` — token saved at `~/.config/21st/auth.json`
(keys: `token`, `user`, `savedAt`).

Verify: `21st whoami` · Search: `21st search <query>` · Help: `21st --help`

## CI / scripts (no login)

`21st login` needs an interactive browser, so in CI or scripts authenticate with
an API key instead (get one at https://21st.dev/mcp). Any of the following work:

```bash
# 1. Flag (explicit, recommended in scripts):
21st search "button" --api-key "$API_KEY_21ST"

# 2. Environment variable (API key):
export API_KEY_21ST="..."
21st search "button"

# 3. Environment variable (token, alternative):
export TWENTYFIRST_TOKEN="..."
21st search "button"
```

Precedence: `--api-key` flag > `API_KEY_21ST` env > `TWENTYFIRST_TOKEN` env > saved login.

## Notes

- `21st logout` clears the saved login.
- `21st whoami` confirms the signed-in account; `21st usage` shows tier + quota.
- Docs: https://help.21st.dev/cli
