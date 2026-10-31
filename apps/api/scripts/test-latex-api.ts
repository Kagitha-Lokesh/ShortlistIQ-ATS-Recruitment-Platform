const source = `\\documentclass{article}
\\begin{document}
Hello LaTeX World
\\end{document}`;

const res = await fetch('https://latex.ytotech.com/builds/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    compiler: 'pdflatex',
    resources: [{ main: true, content: source }]
  })
});

console.log('Status:', res.status);
console.log('Content-Type:', res.headers.get('content-type'));
if (res.ok) {
  const buf = await res.arrayBuffer();
  console.log('PDF size bytes:', buf.byteLength);
} else {
  const text = await res.text();
  console.log('Error:', text);
}
