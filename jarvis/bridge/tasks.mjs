import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'

/**
 * The to-do list, which lives in the browser.
 *
 * Like the camera and unlike everything else here, this has to ask and wait.
 * The list is Ibrahim's, it is in localStorage so it outlives any one
 * conversation, and it is on screen where he can edit it by hand. That makes
 * the browser the owner and this server a client of it, so both tools ride the
 * same request/reply channel the camera uses rather than the one-way push the
 * display tools get.
 *
 * Two tools, not five. The bridge's own guidance is to keep the count low, and
 * the missing verbs are missing on purpose: there is no delete and no edit,
 * because a list that an assistant can quietly rewrite is a list you cannot
 * trust. He removes things. JARVIS adds them and ticks them off.
 */

const LIST_DESCRIPTION = `Read Ibrahim's to-do list.

Call this before planning his day, before building him a timetable, and any
time he asks what he has on. The list is the only record of what he actually
intends to do; his calendar holds the fixed points and this holds everything
else, so a plan built without reading it is a plan built from half the
information.

Returns each item with whether it is done and the day it is promised to, if
any. Items with no day are on the list without being committed to a date,
which is usually where the useful slack is.`

const ADD_DESCRIPTION = `Put something on Ibrahim's to-do list.

Use it when he says he needs to do something, not as a way of turning your own
suggestions into his commitments. "Add revise elasticity to my list" is a yes.
Deciding by yourself that he ought to revise elasticity and adding it is a no,
and it is the thing that makes a list stop being trustworthy.

One item per call, phrased the way he said it rather than formalised. \`due\`
is optional and must be an exact date, YYYY-MM-DD, which you work out from
today's date rather than passing words like "tomorrow" through.`

/** @param {(kind: string, args: object) => Promise<any>} ask */
export function tasksServer(ask) {
  return createSdkMcpServer({
    name: 'jarvis_tasks',
    version: '1.0.0',
    instructions:
      "Ibrahim's to-do list, stored in the interface. Read it before planning " +
      'anything; add to it only when he asks you to.',
    // Never deferred behind tool search. If the model has to go looking for the
    // list, it will plan his day without it and the plan will be wrong.
    alwaysLoad: true,
    tools: [
      tool('list_tasks', LIST_DESCRIPTION, {}, async () => {
        let reply
        try {
          reply = await ask('tasks', { op: 'list' })
        } catch (err) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text:
                  `Could not read the to-do list: ${err?.message ?? err}. ` +
                  'Say so in one line and plan without it.',
              },
            ],
          }
        }

        const items = Array.isArray(reply?.todos) ? reply.todos : []
        if (!items.length) {
          return { content: [{ type: 'text', text: 'The to-do list is empty.' }] }
        }

        // Rendered as lines rather than handed over as JSON. The model reads
        // this back to a person out loud, and a JSON blob is one more thing
        // between the list and the sentence.
        const lines = items.map((t) => {
          const box = t.done ? '[done]' : '[ ]'
          const when = t.due ? ` (for ${t.due})` : ''
          return `${box} ${t.text}${when}`
        })
        const open = items.filter((t) => !t.done).length
        return {
          content: [
            {
              type: 'text',
              text: `${items.length} item(s), ${open} still open:\n${lines.join('\n')}`,
            },
          ],
        }
      }),

      tool(
        'add_task',
        ADD_DESCRIPTION,
        {
          text: z.string().describe('The task, in his words. One item.'),
          due: z
            .string()
            .optional()
            .catch(undefined)
            .describe('Exact date as YYYY-MM-DD, or leave out for no fixed day.'),
        },
        async (args) => {
          const text = String(args.text ?? '').trim()
          if (!text) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Not added: the task was empty.' }],
            }
          }
          // Validated here rather than trusted, because a malformed date would
          // sort into the wrong day on screen and quietly go missing.
          const due = /^\d{4}-\d{2}-\d{2}$/.test(String(args.due ?? ''))
            ? String(args.due)
            : null

          try {
            await ask('tasks', { op: 'add', text: text.slice(0, 200), due })
          } catch (err) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: `Could not add it: ${err?.message ?? err}. Tell him it did not save.`,
                },
              ],
            }
          }
          return {
            content: [
              { type: 'text', text: `Added: ${text}${due ? ` for ${due}` : ''}.` },
            ],
          }
        },
      ),
    ],
  })
}
