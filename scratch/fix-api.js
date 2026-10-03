const fs = require('fs');

const files = [
    { path: 'src/app/api/groups/route.ts', searches: [/data: \{/g], replace: "data: { centerId: session.activeCenterId," },
    { path: 'src/app/api/homework/route.ts', searches: [/data: \{\s*lessonId/, /data: \{\s*homeworkId/], replace: ["data: { centerId: session.activeCenterId, lessonId", "data: { centerId: session.activeCenterId, homeworkId"] },
    { path: 'src/app/api/invites/accept/route.ts', searches: [/data: \{\s*studentMembershipId/], replace: ["data: { centerId: session.activeCenterId, studentMembershipId"] },
    { path: 'src/app/api/invites/bulk-import/route.ts', searches: [/data: \{\s*studentMembershipId/], replace: ["data: { centerId: session.activeCenterId, studentMembershipId"] },
    { path: 'src/app/api/invites/redeem/route.ts', searches: [/data: \{\s*studentMembershipId/], replace: ["data: { centerId: session.activeCenterId, studentMembershipId"] },
    { path: 'src/app/api/lessons/route.ts', searches: [/data: \{\s*moduleId/], replace: ["data: { centerId: session.activeCenterId, moduleId"] },
    { path: 'src/app/api/materials/route.ts', searches: [/data: \{\s*materialId/, /data: \{\s*testId/], replace: ["data: { centerId: session.activeCenterId, materialId", "data: { centerId: session.activeCenterId, testId"] },
    { path: 'src/app/api/modules/route.ts', searches: [/data: \{\s*courseId/], replace: ["data: { centerId: session.activeCenterId, courseId"] },
];

for (const file of files) {
    if (fs.existsSync(file.path)) {
        let content = fs.readFileSync(file.path, 'utf8');
        for (let i = 0; i < file.searches.length; i++) {
             const replacement = Array.isArray(file.replace) ? file.replace[i] : file.replace;
             content = content.replace(file.searches[i], replacement);
        }
        fs.writeFileSync(file.path, content);
        console.log(`Updated ${file.path}`);
    }
}
