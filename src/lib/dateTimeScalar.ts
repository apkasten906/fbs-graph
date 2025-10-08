import { GraphQLScalarType, Kind } from 'graphql';
export const DateTime = new GraphQLScalarType({
  name: 'DateTime',
  description: 'ISO 8601 date-time string',
  serialize(value) {
    if (value == null) return null as any;
    const d = typeof value === 'string' ? new Date(value) : new Date(value as any);
    return isNaN(d.getTime()) ? null : d.toISOString();
  },
  parseValue(value) {
    return new Date(value as any);
  },
  parseLiteral(ast) {
    if (ast.kind !== Kind.STRING) return null;
    const d = new Date(ast.value);
    return isNaN(d.getTime()) ? null : d;
  },
});
