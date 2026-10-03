const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('src/app/api');
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('.create({') || content.includes('.createMany({')) {
        // Replace `data: { ... }` inside `.create` with `data: { ... } as any`
        content = content.replace(/(create\(\s*\{[\s\S]*?data:\s*\{[\s\S]*?\})(\s*\})/g, '$1 as any$2');
        content = content.replace(/(createMany\(\s*\{[\s\S]*?data:\s*(?:\[|{)[\s\S]*?(?:\]|}))(\s*\})/g, '$1 as any$2');
        fs.writeFileSync(file, content);
        console.log(`Updated ${file}`);
    }
});
