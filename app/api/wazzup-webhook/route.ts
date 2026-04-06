import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

const TMP_FILE = '/tmp/wazzup-group-chatids.json'

function loadStoredChatIds(): Record<string, any> {
  try {
    if (fs.existsSync(TMP_FILE)) {
      return JSON.parse(fs.readFileSync(TMP_FILE, 'utf-8'))
    }
  } catch {
    // ignore
  }
  return {}
}

function saveChatId(chatId: string, data: any) {
  const stored = loadStoredChatIds()
  stored[chatId] = { ...data, capturedAt: new Date().toISOString() }
  fs.writeFileSync(TMP_FILE, JSON.stringify(stored, null, 2))
}

/**
 * POST - Receive Wazzup webhooks
 * Wazzup sends a test POST {test: true} when configuring, expects 200 OK
 * Then sends incoming messages with { messages: [...] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Test request from Wazzup when configuring webhook
    if (body.test === true) {
      console.log('✅ Wazzup webhook test request received')
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    // Process incoming messages
    if (body.messages && Array.isArray(body.messages)) {
      for (const msg of body.messages) {
        console.log(`📩 Webhook message: chatType=${msg.chatType}, chatId=${msg.chatId}, text=${msg.text?.substring(0, 50)}`)

        // Capture group chatIds
        if (msg.chatType === 'whatsgroup') {
          console.log(`🎯 GROUP CHAT ID CAPTURED: ${msg.chatId}`)
          saveChatId(msg.chatId, {
            chatType: msg.chatType,
            channelId: msg.channelId,
            contactName: msg.contact?.name,
            text: msg.text?.substring(0, 100),
          })
        }
      }
    }

    // Process status updates
    if (body.statuses && Array.isArray(body.statuses)) {
      for (const status of body.statuses) {
        console.log(`📊 Status update: messageId=${status.messageId}, status=${status.status}`)
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error('❌ Webhook error:', error)
    // Still return 200 to avoid Wazzup retries
    return NextResponse.json({ ok: true }, { status: 200 })
  }
}

/**
 * GET - Retrieve captured group chatIds
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('x-api-key')
  if (authHeader !== '9a807d7e759044d78ae1049e5ef2e273') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stored = loadStoredChatIds()
  return NextResponse.json({
    groupChatIds: stored,
    count: Object.keys(stored).length,
    message: Object.keys(stored).length === 0
      ? 'No group chatIds captured yet. Send a message in the WhatsApp group to capture the chatId.'
      : 'Group chatIds captured successfully!'
  })
}
