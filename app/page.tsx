'use client'
import {
  useState
} from 'react'

import Image from "next/image";
export default function Home() {
    const [query,setQuery]=useState('');
    const [result,setResult]=useState('');
    const [loading,setLoading]=useState(false);

    async function createIndexAndEmbeddings()
    {
        try
        {
            const result =await fetch('/api/setup',{
                method:'POST'
            });
            const json = await result.json();
            console.log(json);
        }
        catch(e)
        {
            console.log(e);
        }
        

    }
   async function sendQuery() {
  if (!query.trim()) return;

  setResult('');
  setLoading(true);

  try {
    const res = await fetch('/api/read', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',   // חובה
      },
      body: JSON.stringify({ prompt: query }) // שם השדה שעליו ה-API יושב
    });

    if (!res.ok) {
      // נניח שה-API מחזיר { error: "..."}
      const { error } = await res.json();
      throw new Error(error ?? `status ${res.status}`);
    }

    const { answer } = await res.json(); // שינינו בשרת ל-answer
    setResult(answer);
  } catch (e) {
    console.error(e);
    setResult(`⚠️ ${e instanceof Error ? e.message : e}`);
  } finally {
    setLoading(false);
  }
}

  return (
    <main className="flex flex-col items-center justify-between p-24">
    <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && sendQuery()}
        className="text-black px-2 py-1"
    />
      <button
          disabled={loading}
          className="px-7 py-1 rounded-2xl bg-white text-black mt-2 mb-2 disabled:opacity-50"
          onClick={sendQuery}
        >
          {loading ? 'Asking…' : 'Ask AI'}
        </button>

      {loading && <p>Asking AI...</p>}

      {result && <p>{result}</p>}
      <button
        onClick={createIndexAndEmbeddings}
        className="px-7 py1 rounded-2xl bg-white text-black mt-2 mb-2"
        >
          Create Index and Embeddings

      </button>
    </main>
  );
}