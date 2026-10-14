export interface TemplateNode {
  title: string;
  description?: string;
  children?: TemplateNode[];
}

export interface SyllabusTemplate {
  id: string;
  name: string;
  description: string;
  nodes: TemplateNode[];
  countNodes: () => number;
}

/**
 * GATE Computer Science — an OPTIONAL starting point.
 *
 * Nothing is hardcoded to GATE: this is one template among potentially many,
 * imported only when a user explicitly chooses it. Topic titles follow the
 * official GATE CS syllabus headings, grouped by subject.
 */
const nodes: TemplateNode[] = [
  {
    title: 'Engineering Mathematics',
    children: [
      { title: 'Discrete Mathematics', children: [
        { title: 'Propositional Logic' },
        { title: 'First Order Logic' },
        { title: 'Sets, Relations and Functions' },
        { title: 'Partial Orders and Lattices' },
        { title: 'Monoids and Groups' },
        { title: 'Combinatorics' },
        { title: 'Graph Theory' },
      ] },
      { title: 'Linear Algebra', children: [
        { title: 'Matrices and Determinants' },
        { title: 'Eigenvalues and Eigenvectors' },
        { title: 'Systems of Linear Equations' },
        { title: 'LU Decomposition' },
      ] },
      { title: 'Probability and Statistics', children: [
        { title: 'Random Variables' },
        { title: 'Distributions' },
        { title: 'Conditional Probability and Bayes Theorem' },
        { title: 'Mean, Median, Mode and Standard Deviation' },
      ] },
      { title: 'Calculus', children: [
        { title: 'Limits, Continuity and Differentiability' },
        { title: 'Maxima and Minima' },
        { title: 'Mean Value Theorem' },
        { title: 'Integration' },
      ] },
    ],
  },
  {
    title: 'Digital Logic',
    children: [
      { title: 'Number Systems and Representation' },
      { title: 'Boolean Algebra' },
      { title: 'Karnaugh Maps and Minimization' },
      { title: 'Combinational Circuits' },
      { title: 'Sequential Circuits' },
      { title: 'Fixed and Floating Point Arithmetic' },
    ],
  },
  {
    title: 'Computer Organization and Architecture',
    children: [
      { title: 'Machine Instructions and Addressing Modes' },
      { title: 'ALU, Data-path and Control Unit' },
      { title: 'Instruction Pipelining' },
      { title: 'Cache and Main Memory' },
      { title: 'Secondary Storage and I/O' },
    ],
  },
  {
    title: 'Programming and Data Structures',
    children: [
      { title: 'Programming in C' },
      { title: 'Recursion' },
      { title: 'Arrays, Stacks and Queues' },
      { title: 'Linked Lists' },
      { title: 'Trees and Binary Search Trees' },
      { title: 'Heaps' },
      { title: 'Graphs' },
      { title: 'Hashing' },
    ],
  },
  {
    title: 'Algorithms',
    children: [
      { title: 'Asymptotic Analysis' },
      { title: 'Searching and Sorting' },
      { title: 'Divide and Conquer' },
      { title: 'Greedy Algorithms' },
      { title: 'Dynamic Programming' },
      { title: 'Graph Traversals and Shortest Paths' },
      { title: 'Minimum Spanning Trees' },
      { title: 'Complexity Classes' },
    ],
  },
  {
    title: 'Theory of Computation',
    children: [
      { title: 'Regular Expressions and Finite Automata' },
      { title: 'Context-Free Grammars and Pushdown Automata' },
      { title: 'Regular and Context-Free Languages' },
      { title: 'Pumping Lemma' },
      { title: 'Turing Machines and Undecidability' },
    ],
  },
  {
    title: 'Compiler Design',
    children: [
      { title: 'Lexical Analysis' },
      { title: 'Parsing' },
      { title: 'Syntax-Directed Translation' },
      { title: 'Intermediate Code Generation' },
      { title: 'Runtime Environments' },
      { title: 'Local Optimization' },
      { title: 'Data Flow Analyses' },
    ],
  },
  {
    title: 'Operating System',
    children: [
      { title: 'Processes, Threads and Context Switching' },
      { title: 'Concurrency and Synchronization' },
      { title: 'Deadlock' },
      { title: 'CPU Scheduling' },
      { title: 'Memory Management and Virtual Memory' },
      { title: 'File Systems' },
      { title: 'Disk Scheduling' },
    ],
  },
  {
    title: 'Databases',
    children: [
      { title: 'ER Model' },
      { title: 'Relational Algebra and Tuple Calculus' },
      { title: 'SQL' },
      { title: 'Integrity Constraints and Normal Forms' },
      { title: 'File Organization and Indexing' },
      { title: 'Transactions and Concurrency Control' },
    ],
  },
  {
    title: 'Computer Networks',
    children: [
      { title: 'Layering and OSI Model' },
      { title: 'Data Link Layer and MAC Protocols' },
      { title: 'IPv4, IPv6, CIDR and Subnetting' },
      { title: 'Routing Protocols' },
      { title: 'TCP, UDP and Sockets' },
      { title: 'Application Layer Protocols' },
      { title: 'Network Security and Cryptography Basics' },
    ],
  },
];

const countNodes = (list: TemplateNode[]): number =>
  list.reduce((total, node) => total + 1 + (node.children ? countNodes(node.children) : 0), 0);

export const GATE_CS_TEMPLATE: SyllabusTemplate = {
  id: 'gate-cs',
  name: 'GATE Computer Science',
  description:
    'Optional GATE CS syllabus outline: 10 subjects with 63 topics. Import creates syllabus nodes only — no dates and no reminders.',
  nodes,
  countNodes: () => countNodes(nodes),
};
