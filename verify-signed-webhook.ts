import jwt from "jsonwebtoken"
import { sha256 } from "js-sha256"
import express, { RequestHandler } from "express"
import bodyParser from "body-parser"

interface Token {
  iat: number
  jti: string
  iss: "Vonage"
  payload_hash: string
  api_key: string
  application_id: string
}

const VONAGE_API_SIGNATURE_SECRET = process.env.VONAGE_API_SECRET as string
const app = express()
app.use(bodyParser.json())
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
)

const handleInboundMessage: RequestHandler = (request, response) => {
  const payload = Object.assign(request.query, request.body)
  const token = request.headers.authorization
    ? request.headers.authorization.split(" ")[1]
    : null

  if (token === null) {
    console.log("No token detected")
    response.status(401).send()
  }

  try {
    const decoded = jwt.verify(token as string, VONAGE_API_SIGNATURE_SECRET, {
      algorithms: ["HS256"],
    }) as Token

    if (sha256(JSON.stringify(payload)) != decoded["payload_hash"]) {
      console.log("Tampering detected")
      response.status(401).send()
    } else {
      console.log("Success!")
      response.status(204).send()
    }
  } catch (error) {
    console.log("Bad token detected")
    response.status(401).send()
  }
}

app.route("/webhooks/inbound-message").post(handleInboundMessage)

app.listen(3000, () => {
  console.log("Listening on port 3000")
})
