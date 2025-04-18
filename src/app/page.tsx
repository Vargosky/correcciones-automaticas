'use client';

import { useState, FormEvent } from 'react';

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [basePrompt, setBasePrompt] = useState<string>('');
  const [resultado, setResultado] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Por favor selecciona un archivo .docx');
      return;
    }
    setLoading(true);
    setError('');
    setResultado('');
    const formData = new FormData();
    formData.append('docx', file);
    formData.append('prompt', basePrompt);
    try {
      const res = await fetch('/api/procesar', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error en la petición');
      } else {
        setResultado(data.resultado);
      }
    } catch (err) {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Corrección Automática de DOCX</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Prompt adicional:</span>
          <textarea
            value={basePrompt}
            onChange={(e) => setBasePrompt(e.target.value)}
            placeholder="Describe detalles adicionales para el prompt..."
            className="mt-1 block w-full border rounded p-2"
            rows={4}
          />
        </label>
        <input
          type="file"
          accept=".docx"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full"
        />
        <button
          type="submit"
          disabled={loading}
          className={`px-4 py-2 rounded ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
        >
          {loading ? 'Procesando...' : 'Procesar'}
        </button>
      </form>
      {error && <p className="mt-4 text-red-600">{error}</p>}
      {resultado && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">Resultado</h2>
          <pre className="bg-gray-100 p-4 rounded whitespace-pre-wrap">{resultado}</pre>
        </div>
      )}
    </main>
  );
}
