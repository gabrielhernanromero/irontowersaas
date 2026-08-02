/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react' } }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/.claude/', '/.next/'],
  // Piso de cobertura para los archivos que implementan la Regla 3
  // (NO → observación obligatoria) de CLAUDE.md. Calibrado al nivel medido
  // al momento de agregar este check: protege contra regresiones, no exige 100%.
  // NOTA: checkDuplicatePlanilla.ts (regla 1) y createAlerta.ts (regla 4) no
  // tienen tests hoy — no se les puso threshold acá porque un piso de 0% no
  // protege nada; falta escribirles tests (ver CLAUDE.md).
  coverageThreshold: {
    './src/lib/validations/extintor.ts': { statements: 100, branches: 75, functions: 100, lines: 100 },
    './src/lib/validations/libroGuardia.ts': { statements: 75, branches: 69, functions: 100, lines: 75 },
    './src/lib/validations/planilla.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
    './src/lib/validations/planillaGenerica.ts': { statements: 98, branches: 97, functions: 100, lines: 100 },
  },
}
