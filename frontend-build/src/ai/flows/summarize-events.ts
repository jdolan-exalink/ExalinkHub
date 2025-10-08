// Summarize key events within a specified timeframe and camera set.

'use server';

/**
 * @fileOverview Summarizes key events within a specified timeframe and camera set.
 *
 * - summarizeEvents - A function that handles the summarization of events.
 * - SummarizeEventsInput - The input type for the summarizeEvents function.
 * - SummarizeEventsOutput - The return type for the summarizeEvents function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeEventsInputSchema = z.object({
  startTime: z.string().describe('The start time for the event summary.'),
  endTime: z.string().describe('The end time for the event summary.'),
  cameras: z.array(z.string()).describe('The cameras to include in the event summary.'),
  events: z.string().describe('The events data in json format.'),
});
export type SummarizeEventsInput = z.infer<typeof SummarizeEventsInputSchema>;

const SummarizeEventsOutputSchema = z.object({
  summary: z.string().describe('A summary of the key events.'),
});
export type SummarizeEventsOutput = z.infer<typeof SummarizeEventsOutputSchema>;

export async function summarizeEvents(input: SummarizeEventsInput): Promise<SummarizeEventsOutput> {
  return summarizeEventsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeEventsPrompt',
  input: {schema: SummarizeEventsInputSchema},
  output: {schema: SummarizeEventsOutputSchema},
  prompt: `You are a security analyst reviewing video surveillance footage.

You will summarize the key events that occurred between {{startTime}} and {{endTime}} for the following cameras: {{cameras}}.

Here are the events in JSON format:
{{{events}}}

Provide a concise summary of the key events, focusing on trends and patterns.`, // Removed Handlebars helper
});

const summarizeEventsFlow = ai.defineFlow(
  {
    name: 'summarizeEventsFlow',
    inputSchema: SummarizeEventsInputSchema,
    outputSchema: SummarizeEventsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
