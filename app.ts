import express, { RequestHandler } from "express"
import bodyParser from "body-parser"
import {
  getGraphQlQuery,
  getHospitals,
  sendWhatsappMsg,
  getFormattedHospitals,
} from "./utils"
require("dotenv").config()

const cityKey: {
  [prop: string]: string
} = {
  bangalore: "bengaluru-karnataka",
  bengaluru: "bengaluru-karnataka",
  pune: "pune-maharashtra",
}

const app = express()

app.use(bodyParser.json())
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
)

const handleInbound: RequestHandler = async (request, response) => {
  const number = request.body.from.number
  const content = request.body.message.content
  const text: string = content.text.toLowerCase().trim()

  if (text.startsWith("search for")) {
    let remaining = text.split("search for")[1].trim()

    if (remaining.includes("in")) {
      const split = remaining.split("in")
      const city = split[split.length - 1].trim()
      const searchQuery = split.slice(0, split.length - 1).join("in")
      const graphqlQuery = getGraphQlQuery(cityKey[city], searchQuery)
      const { data, error } = await getHospitals(graphqlQuery)

      if (!error) {
        if (data?.length === 0) {
          sendWhatsappMsg(
            number,
            "Sorry, there were no hospitals that matched your search 🙁"
          )
        } else {
          const formatedHospitals = getFormattedHospitals(data)
          sendWhatsappMsg(number, formatedHospitals)
        }
      }
    } else {
    }
  }

  response.status(200).end()
}

const handleStatus: RequestHandler = (request, response) => {
  console.log(request.body)
  response.status(200).end()
}

app.post("/webhooks/inbound", handleInbound)
app.post("/webhooks/status", handleStatus)
app.listen(3000, () => {
  console.log("Listening on port 3000")
})
