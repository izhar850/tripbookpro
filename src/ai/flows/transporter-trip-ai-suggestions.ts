'use server';
/**
 * @fileOverview An AI agent that suggests optimal freight rates and logistical notes for a trip.
 *
 * - getTransporterTripAISuggestions - A function that handles the AI-powered suggestions process.
 * - TransporterTripAISuggestionsInput - The input type for the getTransporterTripAISuggestions function.
 * - TransporterTripAISuggestionsOutput - The return type for the getTransporterTripAISuggestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TransporterTripAISuggestionsInputSchema = z.object({
  source: z.string().describe('The starting location of the trip.'),
  destination: z.string().describe('The final destination of the trip.'),
  goodsDescription: z.string().describe('A detailed description of the goods being transported.'),
  weight: z.number().describe('The total weight of the goods in quintals.'),
  vehicleType: z.string().describe('The type of vehicle used for transportation (e.g., truck, tempo, trailer).'),
});
export type TransporterTripAISuggestionsInput = z.infer<typeof TransporterTripAISuggestionsInputSchema>;

const TransporterTripAISuggestionsOutputSchema = z.object({
  suggestedRateQtl: z.number().describe('The suggested optimal freight rate per quintal in local currency.'),
  logisticalNotes: z.string().describe('AI-generated logistical notes, including potential route challenges, optimal timings, special handling considerations, or regulatory advice.'),
});
export type TransporterTripAISuggestionsOutput = z.infer<typeof TransporterTripAISuggestionsOutputSchema>;

export async function getTransporterTripAISuggestions(input: TransporterTripAISuggestionsInput): Promise<TransporterTripAISuggestionsOutput> {
  return transporterTripAISuggestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'transporterTripAISuggestionsPrompt',
  input: {schema: TransporterTripAISuggestionsInputSchema},
  output: {schema: TransporterTripAISuggestionsOutputSchema},
  prompt: `You are an expert logistics and freight pricing consultant.

Analyze the following trip details and provide an optimal freight rate per quintal and detailed logistical notes.
Consider factors like distance, road conditions, type of goods, and vehicle suitability.

Trip Details:
Source: {{{source}}}
Destination: {{{destination}}}
Goods Description: {{{goodsDescription}}}
Weight (Quintals): {{{weight}}}
Vehicle Type: {{{vehicleType}}}`,
});

const transporterTripAISuggestionsFlow = ai.defineFlow(
  {
    name: 'transporterTripAISuggestionsFlow',
    inputSchema: TransporterTripAISuggestionsInputSchema,
    outputSchema: TransporterTripAISuggestionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
