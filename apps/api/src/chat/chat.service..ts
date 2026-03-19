import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';

// System prompt that defines Dexter's personality and knowledge
const DEXTER_SYSTEM_PROMPT = `Eres Dexter, el asistente virtual de El Búnker, un Board Game Café en Madrid.

PERSONALIDAD:
- Eres amable, divertido y cercano. Hablas como un amigo que te recomienda cosas.
- Usas un tono informal pero respetuoso. Puedes usar algún emoji ocasionalmente.
- Cuando no sabes algo, dices que contacten al local directamente.
- Nunca inventas información. Solo respondes con los datos que tienes.

DATOS DEL LOCAL:
- Nombre: El Búnker Board Game Café
- Dirección: Calle Ejemplo, 42, 28001 Madrid
- Teléfono: 912 345 678
- Email: hola@elbunker.es
- Redes: @elbunkermadrid

HORARIO:
- Lunes a Jueves: 17:00 - 23:00
- Viernes: 17:00 - 00:00
- Sábado: 12:00 - 00:00
- Domingo: 12:00 - 22:00

CÓMO FUNCIONA:
- Cover de 3,50€ por persona para jugar (juegos ilimitados, sin límite de tiempo)
- Puedes venir solo a comer sin pagar cover
- Tenemos más de 500 juegos de mesa
- Nuestro equipo te explica cualquier juego
- Se recomienda reservar, especialmente fines de semana
- Aceptamos sin reserva si hay disponibilidad
- Somos family friendly, niños bienvenidos
- Celebramos cumpleaños y eventos privados

ZONAS:
- Zona Principal: 11 mesas (Barra 1-2, Mesa 1-9). Barras de 3 plazas, mesas de 4-6 plazas.
- Zona Sillones: 7 sillones (Sillón 1-7). Sillones de 4-6 plazas, más cómodos para partidas largas.
- Terraza: 6 mesas (Mesa 10-15). Mesas de 4 plazas al aire libre.
- Se pueden combinar mesas adyacentes para grupos grandes.
- Grupos de más de 10 personas: solicitud especial.

CARTA (Datos reales del menú):
Entrantes: Crazy Nachos (13,95€), Patatas con Mysterium (12,50€), Tequeños de Castronegro (9,35€), Wingspan Fingers (9,50€), Speed Cups con Salsas (9,90€), Quesadilla de Trivial (7,95€), Guacamole (7,95€)
Burgers (con patatas): Modo Clásico (12,50€), Modo Casual (13,50€), Modo Extremo (13,50€), Modo Avanzado (13,75€), Modo Experto (13,75€), Modo Alternativo/vegano (13,95€)
Hotdogs: Hotdog Piko Piko (13,95€), Exploding Hotdog (9,50€), Throw Throw Hotdog (9,50€), Hotdog Agrícola Heura/vegano (9,40€)
Postres: Pingüino de Vainilla (6,75€), Pingüino de Chocolate (6,75€), Cacao Coulant (7,75€), Gofres Against Humanity (8,50€), Cheese Cakes (8,50€)
Bebidas especiales: Bunker Cola 350ml (8,90€) / 500ml (12,90€), Bunker Cherry 350ml (8,90€) / 500ml (12,90€), Estus Flask (preguntar en barra)
Bebidas: Coca-Cola/Fanta (2,90€), Agua (2,00€), Cerveza Mahou (3,75€), Cerveza artesana CCVK (5,00€), Hidromiel Viking Bad (6,30€), Vino tinto/blanco (3,70-3,75€)
Extras: +1€ (cheddar, bacon, jalapeños, salsas), +2€ (heura, guacamole, cebolla caramelizada, queso cabra)
Opciones veganas disponibles.

INSTRUCCIONES:
- Si preguntan por un juego concreto, usa los datos proporcionados en el contexto.
- Si preguntan por reservar, explica que pueden hacerlo desde la web en la sección Reservas.
- Si preguntan por algo que no sabes, sugiere contactar al local.
- Responde SIEMPRE en español.
- Sé conciso: máximo 2-3 párrafos por respuesta.
- NO inventes juegos, precios ni datos que no tengas.`;

@Injectable()
export class ChatService {
  private groqApiKey: string;
  private groqModel: string;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.groqApiKey = this.config.get('GROQ_API_KEY', '');
    this.groqModel = this.config.get('GROQ_MODEL', 'llama-3.1-8b-instant');
  }

  async chat(message: string, history: Array<{ role: string; content: string }> = []) {
    if (!message || message.trim().length === 0) {
      throw new BadRequestException('Mensaje vacío');
    }

    if (!this.groqApiKey) {
      // Fallback: sin API key, responder con mensaje genérico
      return {
        reply: 'Lo siento, no puedo responder ahora. Contacta con nosotros en hola@elbunker.es o llama al 912 345 678. ¡Estaremos encantados de ayudarte!',
        source: 'fallback',
      };
    }
    // Build context: search for games if the message mentions games
    let gameContext = '';
    const gameMentionRegex = /juego|jugar|partida|recomienda|busco|quiero.*juego/i;
    if (gameMentionRegex.test(message)) {
      try {
        const searchTerms = message.replace(/[^a-záéíóúñü\s]/gi, '').split(/\s+/).filter(w => w.length > 3);

        if (searchTerms.length > 0) {
          const games = await this.prisma.game.findMany({
            where: {
              OR: searchTerms.map(term => ({ name: { contains: term, mode: 'insensitive' as any } })),
            },
            take: 5,
            include: {
              types: { include: { type: true } },
              categories: { include: { category: true } },
            },
          });

          if (games.length > 0) {
            gameContext = '\n\nJUEGOS ENCONTRADOS RELEVANTES:\n' + games.map(g =>
              `- ${g.name}: ${g.playersMin}-${g.playersMax} jugadores, ${g.durationMin}-${g.durationMax} min, dificultad ${g.difficulty}/5, edad ${g.ageMin}+. Tipos: ${g.types.map(t => t.type.name).join(', ')}. Categorías: ${g.categories.map(c => c.category.name).join(', ')}.`
            ).join('\n');
          }
        }

        // Also get some popular recommendations if no specific game found
        if (!gameContext) {
          const popular = await this.prisma.game.findMany({
            where: { difficulty: { lte: 2 }, isAvailable: true },
            take: 5,
            orderBy: { name: 'asc' },
            include: { types: { include: { type: true } } },
          });
          if (popular.length > 0) {
            gameContext = '\n\nJUEGOS POPULARES FÁCILES:\n' + popular.map(g =>
              `- ${g.name}: ${g.playersMin}-${g.playersMax} jugadores, ${g.durationMin} min, dificultad ${g.difficulty}/5`
            ).join('\n');
          }
        }
      } catch (dbErr) {
        console.error('Chat: error al buscar juegos en DB:', dbErr);
      }
    }

    // Build messages array for Groq
    const messages = [
      { role: 'system', content: DEXTER_SYSTEM_PROMPT + gameContext },
      ...history.slice(-6), // Keep last 6 messages for context
      { role: 'user', content: message },
    ];

    try {
      // Call Groq API (compatible with OpenAI format)
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.groqApiKey}`,
        },
        body: JSON.stringify({
          model: this.groqModel,
          messages,
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Groq API error:', response.status, error);
        throw new Error('Error de la IA');
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || 'No pude generar una respuesta.';

      return { reply, source: 'groq' };
    } catch (error) {
      console.error('Chat error:', error);
      return {
        reply: 'Ups, tengo un problema técnico ahora mismo. Contacta directamente con el local: hola@elbunker.es o 912 345 678.',
        source: 'error',
      };
    }
  }
}
