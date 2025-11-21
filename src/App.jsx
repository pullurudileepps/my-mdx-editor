import MarkdownView from "./demo";


export default function App() {
  const md = `
- [GitLab CI](#gitlab-ci)
# Online Markdown Editor - The Best Free Markdown Tool 🚀

Experience the **fastest**, *most intuitive*, and ~~hassle-free~~ Markdown editor online!  
Create and preview Markdown instantly with **GitHub Flavored Markdown (GFM)** support.  
# ##  
## ✨ Features of Online Markdown Editor

- **Live Preview**: Instantly see how your Markdown renders  
- **Auto-save**: Never lose your work with local storage backup  
- **File Management**: Create, edit, rename, and delete files easily  
- **Text Formatting**: Supports **bold**, *italic*, ~~strikethrough~~, <sup>superscript</sup>, and <sub>subscript</sub>  
- **Lists**: Easily create **bullet lists** and **numbered lists**  
- **Code Blocks**: Format your code with syntax highlighting  
- **Tables**: Create structured data with Markdown tables  
- **Mermaid Diagrams**: Visualize concepts with flowcharts and graphs  
- **Image & Link Insertion**: Easily add images and links  
- **Print & Download**: Save as a Markdown file or print directly  

---

## 📌 Markdown Syntax Guide  

### Headings  

# H1 - Largest Heading  
## H2 - Second Largest  
### H3 - Subheading  
#### H4 - Smaller Heading  
##### H5 - Tiny Heading  
###### H6 - Smallest Heading  

### ✍️ Text Formatting  
 

### 📋 Lists  

#### Bullet List  
- Item 1  
- Item 2  
- Item 3  

#### Numbered List  
1. First Item  
2. Second Item  
3. Third Item  

### 🔗 Links & Images  

[Visit Online Markdown Editor](https://onlinemarkdown.com)  

![Markdown Logo](https://upload.wikimedia.org/wikipedia/commons/4/48/Markdown-mark.svg)

### 📝 Blockquotes

> "Markdown is a lightweight markup language for creating formatted text using a plain-text editor."
– John Gruber

### Code Blocks


## GitLab CI

## Boeing`;

  return (
    <div>
      <MarkdownView markdown={md} />
    </div>
  );
}
