import express from 'express'
import path from 'path'
import cors from 'cors'
import axios from 'axios'
import bodyParser from 'body-parser'
import sockjs from 'sockjs'
import { renderToStaticNodeStream } from 'react-dom/server'
import React from 'react'

import cookieParser from 'cookie-parser'
import Root from '../client/config/root'

import Html from '../client/html'

const { readFile, writeFile, unlink } = require('fs').promises

const port = process.env.PORT || 8090
const server = express()

server.use(cors())

const setHeaders = (req, res, next) => {
  res.set('x-skillcrucial-user', '07d1a143-554a-4446-8a7c-0af33afe60c7')
  res.set('Access-Control-Expose-Headers', 'X-SKILLCRUCIAL-USER')
  next()
}
server.use(setHeaders)

let connections = []

const middleware = [
  cors(),
  express.static(path.resolve(__dirname, '../dist/assets')),
  bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }),
  bodyParser.json({ limit: '50mb', extended: true }),
  cookieParser()
]

middleware.forEach((it) => server.use(it))

const saveFile = async (users) => {
  return writeFile(`${__dirname}/test.json`, JSON.stringify(users), { encoding: 'utf8' })
}

const fileRead = async () => {
  return readFile(`${__dirname}/test.json`, { encoding: 'utf8' })
    .then((data) => JSON.parse(data))
    .catch(async () => {
      const { data: users } = await axios('https://jsonplaceholder.typicode.com/users')
      await saveFile(users)
    })
}

server.get('/api/v1/users', async (req, res) => {
  const users = await fileRead()
  res.json(users)
})

server.post('/api/v1/users', async (req, res) => {
  const users = await fileRead()
  const newUserBody = req.body
  const userLength = users[users.length - 1].id
  newUserBody.id = userLength + 1
  const newUser = [...users, newUserBody]
  saveFile(newUser)
  res.json({ status: 'success', id: newUserBody.id })
})

server.patch('/api/v1/users/:userId', async (req, res) => {
  const users = await fileRead()
  const { userId } = req.params
  const newUserBody = req.body
  const newUsersArray = users.map((it) => (it.id === +userId ? Object.assign(it, newUserBody) : it))
  saveFile(newUsersArray)
  res.json({ status: 'success', id: userId })
})

server.delete('/api/v1/users/:userId', async (req, res) => {
  const users = await fileRead()
  const { userId } = req.params
  users.splice(Number(userId) - 1, 1)
  saveFile(users)
  res.json({ status: 'success', id: Number(userId) })
})

server.delete('/api/v1/users', async (req, res) => {
  await unlink(`${__dirname}/test.json`)
  res.json()
})

server.use('/api/', (req, res) => {
  res.status(404)
  res.end()
})

const echo = sockjs.createServer()
echo.on('connection', (conn) => {
  connections.push(conn)
  conn.on('data', async () => {})

  conn.on('close', () => {
    connections = connections.filter((c) => c.readyState !== 3)
  })
})

const [htmlStart, htmlEnd] = Html({
  body: 'separator',
  title: 'Skillcrucial - Become an IT HERO'
}).split('separator')

server.get('/', (req, res) => {
  const appStream = renderToStaticNodeStream(<Root location={req.url} context={{}} />)
  res.write(htmlStart)
  appStream.pipe(res, { end: false })
  appStream.on('end', () => {
    res.write(htmlEnd)
    res.end()
  })
})

server.get('/*', (req, res) => {
  const initialState = {
    location: req.url
  }

  return res.send(
    Html({
      body: '',
      initialState
    })
  )
})

const app = server.listen(port)

echo.installHandlers(app, { prefix: '/ws' })

// eslint-disable-next-line no-console
console.log(`Serving at http://localhost:${port}`)
