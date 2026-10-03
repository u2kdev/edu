const fs = require('fs');

const path = './prisma/schema.prisma';
let schema = fs.readFileSync(path, 'utf8');

const addCenterId = (modelName) => {
    const regex = new RegExp(`(model ${modelName} \\{[\\s\\S]*?)(^\\}$|model )`, 'm');
    const match = schema.match(regex);
    if (!match) return;
    
    let block = match[1];
    
    if (block.includes('centerId')) {
        console.log(`${modelName} already has centerId`);
        return; // Already added
    }

    // Insert centerId and its relation/index before the first @@ or the end
    const relationStr = `  centerId            String\n  center              LearningCenter @relation(fields: [centerId], references: [id], onDelete: Cascade)\n`;
    const indexStr = `  @@index([centerId])\n`;

    if (block.includes('@@')) {
        block = block.replace(/(\s*)(@@)/, `\n${relationStr}$1${indexStr}$1$2`);
    } else {
        block += `${relationStr}${indexStr}`;
    }

    schema = schema.replace(match[1], block);
    console.log(`Added centerId to ${modelName}`);
};

const models = [
    'CourseModule',
    'Lesson',
    'Homework',
    'HomeworkSubmission',
    'Test',
    'TestQuestion',
    'TestAttempt'
];

models.forEach(addCenterId);

fs.writeFileSync(path, schema);
console.log('Schema updated successfully');
