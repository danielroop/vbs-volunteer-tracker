export const GRADE_LEVEL_OPTIONS = [
  { value: 'K', label: 'Kindergarten' },
  ...Array.from({ length: 12 }, (_, index) => {
    const grade = String(index + 1);
    return { value: grade, label: `${grade}${getOrdinalSuffix(index + 1)} Grade` };
  }),
];

function getOrdinalSuffix(grade) {
  if (grade >= 11 && grade <= 13) return 'th';
  switch (grade % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}
