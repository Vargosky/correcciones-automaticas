// src/pages/api/procesar.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable-serverless';
const mammoth = require('mammoth');
import db from '../../lib/prisma';

// Deshabilita el bodyParser de Next.js para que Formidable lo maneje
export const config = { api: { bodyParser: false } };

// Tipos de respuesta
type HealthResponse = { status: 'ok'; db: 'connected'; users: number };
type ErrorResponse = { status: 'error'; error: string };
type PostSuccess = { resultado: string; prompt: string };
type PostError = { error: string };
type ResponseData = HealthResponse | ErrorResponse | PostSuccess | PostError;

// Helper para parsear multipart/form-data con Formidable
function parseForm(req: NextApiRequest): Promise<any> {
  return new Promise((resolve, reject) => {
    const form = new formidable.IncomingForm({ keepExtensions: true });
    form.parse(req, (err: any, fields: any, files: any) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method === 'GET') {
    try {
      // Health check: contar usuarios en MongoDB
      const users = await db.user.count();
      return res.status(200).json({ status: 'ok', db: 'connected', users });
    } catch (error: any) {
      console.error('DB ping error:', error);
      return res.status(500).json({ status: 'error', error: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      // Parsear campos y archivos
      const { fields, files } = await parseForm(req);

      // Obtener archivo .docx
      const uploaded = Array.isArray(files.docx) ? files.docx[0] : files.docx;
      if (!uploaded) {
        return res.status(400).json({ error: 'Falta archivo .docx' });
      }

      // Obtener prompt adicional del campo "prompt"
      const extraPrompt = fields.prompt as string || '';

      // Determinar ruta del archivo subido
      const filePath = uploaded.filepath || uploaded.path;
      if (!filePath) {
        return res.status(500).json({ error: 'No se encontró la ruta del archivo subido' });
      }

      // Convertir .docx a Markdown
      const { value: rawText } = await mammoth.convertToMarkdown({ path: filePath });

      // Construir prompt completo para DeepSeek
      const prompt = `
${extraPrompt}

Documento: ${uploaded.originalFilename}

${rawText}

Por favor, devuélveme sólo una tabla Markdown con columnas: Criterio, Cumple (Sí/No) y Observaciones.
      `.trim();

      console.log('DeepSeek prompt:', prompt);

      // Llamar a la API de DeepSeek
      console.log('🔑 DEEPSEEK_API_KEY en Vercel:', process.env.DEEPSEEK_API_KEY);

      const apiRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-reasoner',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 1000,
        }),
      });
      
      if (!apiRes.ok) {
        const errText = await apiRes.text();
        throw new Error(errText);
      }

      const { choices }: any = await apiRes.json();
      const resultado: string = choices?.[0]?.message?.content?.trim() || '';
      // Devolver también el prompt para testeo
      return res.status(200).json({ resultado, prompt });
    } catch (error: any) {
      console.error('Error en POST /api/procesar:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // Métodos no permitidos
  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end('Método no permitido');
}
