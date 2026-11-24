import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  { ignores: ['dist', 'android', 'ios', 'node_modules', 'coverage'] },

  js.configs.recommended,
  tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
    {
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: { globals: globals.node },
  },

  // Regla: el módulo del cliente no importa nada del módulo del personal
  {
    files: ['src/client/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/admin', '**/admin/**'],
          message: 'src/client no puede importar de src/admin.',
        }],
      }],
    },
  },

  // Regla: Presentación no usa Infraestructura directamente
  {
    files: ['src/presentation/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/infrastructure', '**/infrastructure/**'],
          message: 'Presentación debe usar casos de uso, no Infraestructura.',
        }],
      }],
    },
  },

  // Regla: el Dominio no depende de Ionic, Capacitor ni librerías de HTTP
  {
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@ionic/*', '@capacitor/*', 'axios'],
          message: 'El Dominio no puede depender de Ionic, Capacitor ni HTTP.',
        }],
      }],
    },
  },
    {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
    },
  },
]);