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
 * Three tools, not five. The bridge's own guidance is to keep the count low,
 * and delete is missing on purpose: a list an assistant can quietly shrink is
 * a list you cannot trust. He removes things.
 *
 * Edit arrived with the weekly set-work placeholders. Teams will not say what
 * was set, so the list guesses "Philosophy homework, due next Monday", and the
 * guess is only useful if his answer ("it's the Descartes essay, due
 * Thursday") can be written back into it. The tool says it is for exactly
 * that: changing an item on his word, never tidying the list by itself.
 */

const LIST_DESCRIPTION = `Read Ibrahim's to-do list.

Call this before planning his day, before building him a timetable, and any
time he asks what he has on. The list is the only record of what he actually
intends to do; his calendar holds the fixed points and this holds everything
else, so a plan built without reading it is a plan built from half the
information.

Returns each item with whether it is done, the day it is due, if any, and its
id for update_task. Items with no day are on the list without being committed
to a date, which is usually where the useful slack is.

An item marked (assumed) is a placeholder the interface put there because
that subject is always set on that weekday. The day is a guess too: a week
after it was set. Ask him what the work actually is and when it is due, then
fix it with update_task.

Also returns PLANNED: the time the interface has set aside this week, which is
exactly what his timetable tab shows. Set work gets two hours on the evening
it is set; each weekly Response hour (Economics, Maths, Philosophy) sits in
the next free space that fits, and moves on by itself if the time passes
without it being ticked. Plan around these rather than over them, and quote
them as they are rather than inventing different times.`

const ADD_DESCRIPTION = `Put something on Ibrahim's to-do list.

Use it when he says he needs to do something, not as a way of turning your own
suggestions into his commitments. "Add revise elasticity to my list" is a yes.
Deciding by yourself that he ought to revise elasticity and adding it is a no,
and it is the thing that makes a list stop being trustworthy.

One item per call, phrased the way he said it rather than formalised. \`due\`
is optional and must be an exact date, YYYY-MM-DD, which you work out from
today's date rather than passing words like "tomorrow" through. If he gives a
deadline ("due Friday", "by the 2nd"), always pass it as \`due\`, not in the
text.`

const UPDATE_DESCRIPTION = `Change an item on Ibrahim's to-do list: its words, its due day, or whether it is done.

Only on his word. Set \`done\` true when he says he has finished something
("I've done my maths response"), which also takes it off the plan. The other
main use is filling in an assumed placeholder once he tells you what was set: "Philosophy homework" becomes "Philosophy: Descartes
essay, 800 words" and the guessed day becomes the real one. Also for "move the
essay to Thursday" or "the maths sheet has no deadline". Never to tidy,
reword or reschedule the list on your own initiative.

\`task\` is the id from list_tasks; read the list first if you do not have it.
Leave out what is not changing. \`due\` is YYYY-MM-DD, or "none" to take the
date off.`

/** @param {(kind: string, args: object) => Promise<any>} ask */
export function tasksServer(ask) {
  return createSdkMcpServer({
    name: 'jarvis_tasks',
    version: '1.0.0',
    instructions:
      "Ibrahim's to-do list, stored in the interface. Read it before planning " +
      'anything; add to it or change it only when he asks you to.',
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
          return { content: [{ type: 'text', text: 'The to-do list is empty, and nothing is planned.' }] }
        }

        // Rendered as lines rather than handed over as JSON. The model reads
        // this back to a person out loud, and a JSON blob is one more thing
        // between the list and the sentence.
        const lines = items.map((t) => {
          const box = t.done ? '[done]' : '[ ]'
          const when = t.due ? ` (due ${t.due})` : ''
          const guess = t.assumed ? ' (assumed)' : ''
          const what = t.kind === 'response' ? ' (weekly Response hour)' : t.kind === 'setwork' ? ' (set work)' : ''
          return `${box} ${t.text}${when}${what}${guess} [id ${t.id}]`
        })
        const open = items.filter((t) => !t.done).length
        const planned = (Array.isArray(reply?.plan) ? reply.plan : []).map(
          (b) => `- ${b.day} ${b.start}-${b.end}: ${b.title}`,
        )
        const plan = planned.length
          ? `\n\nPLANNED:\n${planned.join('\n')}`
          : '\n\nPLANNED: nothing set aside.'
        return {
          content: [
            {
              type: 'text',
              text: `${items.length} item(s), ${open} still open:\n${lines.join('\n')}${plan}`,
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

      tool(
        'update_task',
        UPDATE_DESCRIPTION,
        {
          task: z.string().describe('The item id from list_tasks.'),
          text: z
            .string()
            .optional()
            .catch(undefined)
            .describe('The new wording, in his words. Leave out to keep it.'),
          due: z
            .string()
            .optional()
            .catch(undefined)
            .describe('YYYY-MM-DD, or "none" to clear it. Leave out to keep it.'),
          done: z
            .boolean()
            .optional()
            .catch(undefined)
            .describe('true when he says it is finished, false to reopen it.'),
        },
        async (args) => {
          const task = String(args.task ?? '').trim()
          const done = typeof args.done === 'boolean' ? args.done : undefined
          const text = typeof args.text === 'string' && args.text.trim() ? args.text.trim().slice(0, 200) : undefined
          const raw = typeof args.due === 'string' ? args.due.trim() : undefined
          let due
          if (raw === undefined || raw === '') due = undefined
          else if (/^none$/i.test(raw)) due = null
          else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) due = raw
          else {
            return {
              isError: true,
              content: [{ type: 'text', text: `Not changed: "${raw}" is not a date. Use YYYY-MM-DD or "none".` }],
            }
          }
          if (!task || (text === undefined && due === undefined && done === undefined)) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Not changed: give the item id and what to change.' }],
            }
          }

          let reply
          try {
            reply = await ask('tasks', { op: 'update', task, text, due, done })
          } catch (err) {
            return {
              isError: true,
              content: [{ type: 'text', text: `Could not change it: ${err?.message ?? err}. Tell him it did not save.` }],
            }
          }
          if (reply?.error) {
            return { isError: true, content: [{ type: 'text', text: `Not changed: ${reply.error} Read the list again.` }] }
          }
          const what = [
            text && `now "${text}"`,
            due === null ? 'no date' : due && `due ${due}`,
            done === true ? 'done' : done === false && 'reopened',
          ].filter(Boolean)
          return { content: [{ type: 'text', text: `Changed: ${what.join(', ')}.` }] }
        },
      ),
    ],
  })
}
