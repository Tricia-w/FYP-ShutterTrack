import styles from './Loader.module.css'

export default function Loader({
  text = 'Loading data...',
  fullPage = false,
}) {
  return (
    <div
      className={`${styles.wrapper} ${
        fullPage ? styles.fullPage : ''
      }`}
    >
      <div className={styles.loader} aria-hidden="true">
        <div className={styles.shuttle}>
          <div className={styles.feathers}>
            <span />
            <span />
            <span />
          </div>

          <div className={styles.head} />
        </div>

        <div className={styles.shadow} />
      </div>

      <div className={styles.text}>{text}</div>
    </div>
  )
}