'use server';
/**
 * @fileOverview A Genkit flow for categorizing and prioritizing events from Frigate instances.
 *
 * - categorizeAndPrioritizeEvents - A function that categorizes and prioritizes events based on configurable rules.
 * - CategorizeAndPrioritizeEventsInput - The input type for the categorizeAndPrioritizeEvents function.
 * - CategorizeAndPrioritizeEventsOutput - The return type for the categorizeAndPrioritizeEvents function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CategorizeAndPrioritizeEventsInputSchema = z.object({
  eventData: z.object({
    camera: z.string().describe('The name of the camera that detected the event.'),
    label: z.string().describe('The label of the object detected (e.g., person, car, license_plate).'),
    startTime: z.string().describe('The date/time the event started.'),
    zones: z.array(z.string()).describe('The zones where the event was detected.'),
    thumbnail: z.string().describe('A thumbnail of the event as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.'),
  }).describe('The event data from Frigate.'),
  rules: z.array(
    z.object({
      criteria: z.object({
        label: z.string().optional().describe('The label to match (e.g., person, car, license_plate). If omitted, matches all labels.'),
        camera: z.string().optional().describe('The camera name to match. If omitted, matches all cameras.'),
        zone: z.string().optional().describe('The zone to match. If omitted, matches all zones.'),
      }).describe('The criteria for the rule.'),
      category: z.string().describe('The category to assign to the event if the criteria are met (e.g., Intrusion, Vehicle Detection).'),
      priority: z.enum(['high', 'medium', 'low']).describe('The priority to assign to the event if the criteria are met.'),
    })
  ).describe('The configurable rules for categorizing and prioritizing events.'),
});
export type CategorizeAndPrioritizeEventsInput = z.infer<typeof CategorizeAndPrioritizeEventsInputSchema>;

const CategorizeAndPrioritizeEventsOutputSchema = z.object({
  category: z.string().describe('The category of the event.'),
  priority: z.enum(['high', 'medium', 'low']).describe('The priority of the event.'),
  reason: z.string().describe('The rule that was triggered.'),
});
export type CategorizeAndPrioritizeEventsOutput = z.infer<typeof CategorizeAndPrioritizeEventsOutputSchema>;

export async function categorizeAndPrioritizeEvents(
  input: CategorizeAndPrioritizeEventsInput
): Promise<CategorizeAndPrioritizeEventsOutput> {
  return categorizeAndPrioritizeEventsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'categorizeAndPrioritizeEventsPrompt',
  input: {schema: CategorizeAndPrioritizeEventsInputSchema},
  output: {schema: CategorizeAndPrioritizeEventsOutputSchema},
  prompt: `You are a security expert analyzing events from a video surveillance system.

You will receive event data and a set of rules. Your task is to categorize and prioritize the event based on these rules.

Event Data:
Camera: {{{eventData.camera}}}
Label: {{{eventData.label}}}
Start Time: {{{eventData.startTime}}}
Zones: {{{eventData.zones}}}
Thumbnail: {{media url=eventData.thumbnail}}

Rules:
{{#each rules}}
  {{@index}}. If the label is {{{this.criteria.label}}}, the camera is {{{this.criteria.camera}}}, and the zone is {{{this.criteria.zone}}}, then the category is {{{this.category}}} and the priority is {{{this.priority}}}. Reason: The {{@index}} rule was triggered
{{/each}}

Based on the event data and the rules, determine the category, priority, and reason for the event. The reason should be the rule number that was triggered.

If no rules are triggered, assign category as "Uncategorized" and priority as "low" and reason as "No rule was triggered".

Output the category, priority, and the rule that was triggered.

Ensure the output is a JSON object with the fields \